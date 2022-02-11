const { expect } = require("chai");
const { ethers } = require("hardhat");
const { soliditySha3 } = require("web3-utils");

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

    token.connect(bob).approve(bridge.address, 10000);

    await bridge.setPeerBalance(100000)
    initial_peer_balance = await bridge.peer_balance();

    bridgeBegBal = await token.balanceOf(bridge.address);
    bobBegBal = await token.balanceOf(bob.address);

    to_chain_id = 7777;
    from_chain_id = 31337; // hardhat default chain id TODO: how to access network config here

    LOCKED = 0;
    REVERT_REQUESTED = 1;
    REVERTED = 2;
    REDEEMED = 3;
    RELEASED = 4;
  });

  it("Sender Lock", async function () {
    const expectedId = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1000,
      0
    );
    const tx = await bridge.connect(bob).lock(to_chain_id, alice.address, token.address, token.address, 1000);
    await expect(tx).to.emit(bridge, 'LockEvent').withArgs(expectedId);
    await expect(bridge.records(expectedId).state == LOCKED);
    expect(await bridge.peer_balance()).to.equal(initial_peer_balance - 1000);
    //const receipt = await tx.wait();
    // approve/transfer events from token
    //for (const event of receipt.events) {
    //  console.log(event);
    //  console.log(`Event ${event.event} with args ${event.args}`);
    // }
    expect(await token.balanceOf(bob.address)).to.equal(bobBegBal - 1000);
    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal + 1000);
  });

  it("Sender Lock & Revert", async function () {
    const _id = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1001,
      0
    );
    const initial_peer_balance = await bridge.peer_balance();
    await expect(await bridge.connect(bob).lock(to_chain_id, alice.address, token.address, token.address, 1001)).to.emit(bridge, 'LockEvent').withArgs(_id);
    await expect(bridge.connect(bob).revert_request(_id)).to.emit(bridge, 'RevertRequestEvent').withArgs(_id);
    await expect(bridge.records(_id).state == REVERT_REQUESTED);

    // event push
    await bridge.connect(relay).handle_revert_response(_id, REVERTED);
    await expect(bridge.records(_id).state == REVERTED);
    // peer balance restored
    expect(await bridge.peer_balance()).to.equal(initial_peer_balance);
  });

  it("Sender Lock & Revert & Redeem", async function () {
    const _id = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1002,
      0
    );

    const initial_peer_balance = await bridge.peer_balance();
    await bridge.connect(bob).lock(to_chain_id, alice.address, token.address, token.address, 1002)
    await bridge.connect(bob).revert_request(_id);

    // event push
    await bridge.connect(relay).handle_revert_response(_id, REVERTED);

    //await bridge.redeem(_id); TODO: raise
    await bridge.connect(bob).redeem(_id);
    await expect(bridge.records(_id).state == REDEEMED);

    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal);
    expect(await token.balanceOf(bob.address)).to.equal(bobBegBal);
  });
});
