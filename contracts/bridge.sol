//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

//TODO: use openzepplin
contract Ownable {
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "bridge: Only owner");
        _;
    }

    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "bridge: zero address");
        owner = newOwner;
    }
}

contract Bridge is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    EnumerableSet.AddressSet private relaySet;

    function removeRelay(address _relay) external onlyOwner returns (bool) {
        require(relaySet.contains(_relay), "bridge: unknown relay");
        require(relaySet.length() > 1, "bridge: at least one relay");
        return relaySet.remove(_relay);
    }

    function addRelay(address _relay) external onlyOwner returns (bool) {
        require(_relay != address(0), "bridge: zero relay address");
        return relaySet.add(_relay);
    }

    modifier onlyRelay() {
        require(relaySet.contains(msg.sender), "bridge: only from relay");
        _;
    }

    constructor(address _relay, address _token) {
        require(_token != address(0), "bridge: zero token address");
        require(_relay != address(0), "bridge: zero relay address");
        owner = msg.sender;
        relaySet.add(_relay);
        token = _token;
    }

    enum TransferState {
        LOCKED,
        REVERT_REQUESTED,
        REVERTED,
        REDEEMED,
        RELEASED
    }

    struct TransferRecord {
        bytes32 id;
        uint256 from_chain_id;
        uint256 to_chain_id;
        address from_address;
        address to_address;
        address from_token;
        address to_token;
        uint256 amount;
        TransferState state;
    }

    event LockEvent(bytes32 indexed);
    event RevertRequestEvent(bytes32 indexed);
    event RevertResponseEvent(bytes32 indexed, TransferState indexed);
    event SupplyEvent(uint256 amount);

    event ReleaseEvent(bytes32 indexed, uint256 amount);
    event RedeemEvent(bytes32 indexed, uint256 amount);

    address public relay;
    address public token; // no need to be state var, but requires verification when lock()
    uint256 counter;

    // assumption under having a single peer chain and single type of token
    // later map(chain -> map(token -> peer_balance)
    uint256 public peer_balance;

    // transfer record
    mapping(bytes32 => TransferRecord) public records;

    function _generateId(
        uint256 from_chain_id,
        uint256 to_chain_id,
        address from_address,
        address to_address,
        address from_token,
        address to_token,
        uint256 amount,
        uint256 _counter,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                from_chain_id,
                to_chain_id,
                from_address,
                to_address,
                from_token,
                to_token,
                amount,
                _counter,
                timestamp
            )
        );
        return digest;
    }

    //TODO: check reentry attack
    function lock(
        uint256 to_chain_id,
        address to_address,
        address from_token,
        address to_token,
        uint256 amount
    ) external {
        require(peer_balance > amount, "bridge: no sufficient peer balance");

        bytes32 id = _generateId(
            block.chainid,
            to_chain_id,
            msg.sender,
            to_address,
            from_token,
            to_token,
            amount,
            counter,
            block.timestamp
        );
        TransferRecord memory rec = TransferRecord({
            id: id,
            from_chain_id: block.chainid,
            to_chain_id: to_chain_id,
            from_address: msg.sender,
            to_address: to_address,
            from_token: from_token,
            to_token: to_token,
            amount: amount,
            state: TransferState.LOCKED
        });
        peer_balance -= amount;
        records[id] = rec;
        counter += 1;
        SafeERC20.safeTransferFrom(
            IERC20(token),
            msg.sender,
            address(this),
            amount
        );
        emit LockEvent(id);
    }

    function redeem(bytes32 id) external {
        require(records[id].id != 0x0, "bridge: record not found");
        require(
            records[id].state == TransferState.REVERTED,
            "bridge: invalid state"
        );
        require(msg.sender == records[id].from_address, "bridge: invalid user");
        records[id].state = TransferState.REDEEMED;
        SafeERC20.safeTransfer(
            IERC20(token),
            records[id].from_address,
            records[id].amount
        );
        emit RedeemEvent(id, records[id].amount);
    }

    function revert_request(bytes32 id) external {
        require(records[id].id != 0x0, "bridge: record not found");
        require(records[id].state == TransferState.LOCKED);
        require(msg.sender == records[id].from_address, "bridge: invalid user");
        records[id].state = TransferState.REVERT_REQUESTED;
        emit RevertRequestEvent(id);
    }

    function handle_revert_response(bytes32 id, TransferState state)
        external
        onlyRelay
    {
        require(records[id].id != 0x0, "bridge: record not found");
        require(
            records[id].state == TransferState.REVERT_REQUESTED,
            "bridge: invalid state"
        );
        records[id].state = state;

        if (state == TransferState.REVERTED) peer_balance += records[id].amount;
    }

    //TODO: check calldata usage again
    function handle_lock(TransferRecord calldata record) external onlyRelay {
        //TODO: perhaps hash id check here?
        peer_balance += record.amount;
        records[record.id] = record;
        records[record.id].state = TransferState.LOCKED;
    }

    function handle_supply(uint256 amount) external onlyRelay {
        peer_balance += amount;
    }

    //TODO: check reentry attack seems okay b/c state is set before transfer
    function release(bytes32 id) external {
        require(records[id].id != 0x0, "bridge: record not found");
        require(
            records[id].state == TransferState.LOCKED,
            "bridge: invalid state"
        );
        require(msg.sender == records[id].to_address, "bridge: invalid user");
        records[id].state = TransferState.RELEASED;
        SafeERC20.safeTransfer(
            IERC20(records[id].to_token),
            records[id].to_address,
            records[id].amount
        );
        emit ReleaseEvent(id, records[id].amount);
    }

    function handle_revert_request(bytes32 id) external onlyRelay {
        require(records[id].id != 0x0, "bridge: record not found");
        require(
            records[id].state == TransferState.LOCKED ||
                records[id].state == TransferState.RELEASED,
            "bridge: invalid state"
        );
        if (records[id].state == TransferState.LOCKED) {
            peer_balance -= records[id].amount;
            records[id].state = TransferState.REVERTED;
        }
        emit RevertResponseEvent(id, records[id].state);
    }

    function approve() external {} // approve bridge to spend msg.sender's token

    function supply(uint256 amount) external onlyOwner {
        SafeERC20.safeTransferFrom(
            IERC20(token),
            address(msg.sender),
            address(this),
            amount
        );
        emit SupplyEvent(amount);
    }

    function balance() external view onlyOwner returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function withdrawal(address) external onlyOwner {} // withrawal from owner

    function setRelay(address) external onlyOwner {} // set relay identity

    function kill() public onlyOwner {
        uint256 _bal = IERC20(token).balanceOf(address(owner));
        SafeERC20.safeTransfer(IERC20(token), address(owner), _bal);
        selfdestruct(payable(address(owner)));
    }
}
