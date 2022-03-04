const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bridge", function () {
  beforeEach(async function() {
    [owner, bob, alice, relay, ..._] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Token", "Token");
    await token.deployed();

    const Bridge = await ethers.getContractFactory("Bridge");
    bridge = await Bridge.deploy(relay.address, token.address);
    await bridge.deployed();

    token.approve(bob.address, 10000);
    token.transfer(bob.address, 10000);

    token.connect(bob).approve(bridge.address, 1000);

    await bridge.setPeerBalance(100000)

    to_chain_id = 7777;
  });

  it("Lock and release single side", async function () {
    const amt = 1000;
    const begBal = await token.balanceOf(bridge.address);
    await expect(bridge.connect(bob).lock(to_chain_id, alice.address, token.address, token.address, amt)).to.emit(bridge, 'LockEvent');
    await expect(await token.balanceOf(bridge.address)).to.equal(begBal + amt);

  });
});
