//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint8 dec;
    constructor(string memory name, string memory symbol, uint8 decimal) ERC20(name, symbol) {
        // Mint 100 tokens to msg.sender
        // Similar to how
        // 1 dollar = 100 cents
        // 1 token = 1 * (10 ** decimals)
        dec = decimal;
        _mint(msg.sender, 1000000000000000000000 * 10**uint(decimals()));
    }

    function decimals() public view override(ERC20) returns (uint8) {
      return dec;
    }
}
