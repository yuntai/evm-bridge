//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

//TODO: use openzepplin
contract Ownable {
    address public owner;
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }
}

contract Bridge is Ownable {
    using SafeERC20 for ERC20;

	constructor(address _relay, address _token) {
		owner = msg.sender;
		relay = _relay;
		token = _token;
	}

    //TODO: use openzepplin role library
	modifier onlyRelay {
		require(msg.sender == relay);
		_;
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
		uint from_chain_id; 
		address from_address; 
		address from_token; 
		uint to_chain_id; 
		address to_address; 
		address to_token;
		uint amount;
		TransferState state;
	}

	event LockEvent(bytes32 indexed);
	event RevertRequestEvent(bytes32 indexed);
	event RevertResponseEvent(bytes32 indexed, TransferState);

	address relay;
    address token;

	// assumption under having a single peer chain and single type of token
	// later map(chain -> map(token -> peer_balance) 
	uint peer_balance;

	// transfer record
	mapping(bytes32=>TransferRecord) public records;

	function _generateId(uint to_chain_id, uint from_chain_id, address from_address, address to_address, address from_token, address to_token, uint amount) internal pure returns(bytes32) {
		bytes32 digest = keccak256(                                                                     
			abi.encodePacked(                                                                           
                to_chain_id, from_chain_id,
				from_address, to_address,
				from_token, to_token,
				amount
			)                                                                                           
		);                                                                                              
		return digest;
	}

	function lock(uint to_chain_id, address to_address, address from_token, address to_token, uint amount) external {
		require(peer_balance > amount, "no sufficient peer balance");
        bytes32 id = _generateId(block.chainid, to_chain_id, msg.sender, to_address, from_token, to_token, amount);
		TransferRecord memory rec = TransferRecord({
			id: id,
			from_chain_id: block.chainid,
			from_address: msg.sender,
			from_token: from_token,
			to_chain_id: to_chain_id,
			to_address: to_address,	
			to_token: to_token,
            amount: amount,
			state: TransferState.LOCKED
		});

		peer_balance -= amount;
		ERC20(token).safeTransferFrom(msg.sender, address(this), amount);
		records[id] = rec;	
		emit LockEvent(id);
    }

	function redeem(bytes32 id) external {
		require(records[id].id != 0x0, "record not found");
		require(records[id].state == TransferState.REVERTED, "invalid state");
		records[id].state = TransferState.REDEEMED;
		ERC20(token).safeTransferFrom(address(this), records[id].from_address, records[id].amount);
    }

	function revert_request(bytes32 id) external onlyRelay {
		require(records[id].id != 0x0, "record not found");
		require(records[id].state == TransferState.LOCKED);
	  	records[id].state = TransferState.REVERT_REQUESTED;
		emit RevertRequestEvent(id);
    }

	function handle_revert_response(bytes32 id, TransferState state) external onlyRelay {
		require(records[id].id != 0x0, "record not found");
		require(records[id].state == TransferState.REVERT_REQUESTED, "invalid state");
		records[id].state = state;

	  	if(state == TransferState.REVERTED)
			peer_balance += records[id].amount;
    }

	function handle_lock(TransferRecord calldata record) onlyRelay external {
		peer_balance += record.amount;
		records[record.id] = record;
		records[record.id].state = TransferState.LOCKED;
	}
			
	function release(bytes32 id) external {
		require(records[id].id != 0x0, "record not found");
  		require(records[id].state == TransferState.LOCKED);
  		records[id].state = TransferState.RELEASED;
  		ERC20(token).safeTransferFrom(address(this), msg.sender, records[id].amount);
    }


	function handle_revert_request(bytes32 id) external onlyRelay {
		require(records[id].id != 0x0, "record not found");
  		require(records[id].state == TransferState.LOCKED || records[id].state == TransferState.RELEASED, "invalid state");
		if(records[id].state == TransferState.LOCKED) {
			peer_balance -= records[id].amount;
    		records[id].state = TransferState.REVERTED;
		}
		emit RevertResponseEvent(id, records[id].state);
    }

	function approve() external {} // approve bridge to spend msg.sender's token
	function deposit() external onlyOwner {} // deposit token from owner
	function withdrawal(address) external onlyOwner {} // withrawal from owner
	function setRelay(address) external onlyOwner {} // set relay identity
	function setPeerBalance(uint amount) external onlyOwner { // manual balance
        peer_balance = amount;
    }
}
