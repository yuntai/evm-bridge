const { expect } = require("chai");
const { ethers } = require("hardhat");
const { soliditySha3 } = require("web3-utils");


//TODO: more negative test case
//      check against onlyOwner, onlyRelay, to_address, from_address
//      peer balance

describe("Bridge", function () {
  let token;
  let bridge;
  let to_chain_id, from_chain_id;

  let bridgeBegBal;
  let bobBegBal;
  let initialPeerBalance;

  // Bridge.TransferState
  LOCKED = 0;
  REVERT_REQUESTED = 1;
  REVERTED = 2;
  REDEEMED = 3;
  RELEASED = 4;

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

    token.approve(alice.address, 990);
    token.transfer(alice.address, 990);

    token.connect(bob).approve(bridge.address, 10000);

    await bridge.setPeerBalance(100000)
    //TODO: use bignumber
    initialPeerBalance = +(await bridge.peer_balance());

    token.approve(bridge.address, 10000);
    token.transfer(bridge.address, 10000);
    bridgeBegBal = +(await token.balanceOf(bridge.address));

    bobBegBal = +(await token.balanceOf(bob.address));

    to_chain_id = 7777;
    from_chain_id = 31337; // hardhat default chain id TODO: how to access network config here
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
    expect(await bridge.peer_balance()).to.equal(initialPeerBalance-1000);
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
    await expect(await bridge.connect(bob).lock(to_chain_id, alice.address, token.address, token.address, 1001)).to.emit(bridge, 'LockEvent').withArgs(_id);
    await expect(bridge.connect(bob).revert_request(_id)).to.emit(bridge, 'RevertRequestEvent').withArgs(_id);
    await expect(bridge.records(_id).state == REVERT_REQUESTED);

    // event push
    await bridge.connect(relay).handle_revert_response(_id, REVERTED);
    await expect(bridge.records(_id).state == REVERTED);
    // peer balance restored
    expect(await bridge.peer_balance()).to.equal(initialPeerBalance);
  });

  it("Sender Lock & Revert & Redeem", async function () {
    const _id = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1002,
      0
    );

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

  it("Receiver Lock & Release", async function () {
    const aliceBegBal = +(await token.balanceOf(alice.address));

    const _id = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1002,
      0
    );

    let transferRecord = {
      id: _id,
      from_chain_id: from_chain_id,
      to_chain_id: to_chain_id,
      from_address: bob.address,
      to_address: alice.address,
      from_token: token.address,
      to_token: token.address,
      amount: 1002,
      state: LOCKED
    }

    // invoke lock event handler
    await bridge.connect(relay).handle_lock(transferRecord);
    const x = await bridge.peer_balance()
    expect(await bridge.peer_balance()).to.equal(initialPeerBalance+1002);
    await expect(bridge.records(_id).state == LOCKED);

    await bridge.connect(alice).release(_id)

    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal-1002);
    expect(await token.balanceOf(alice.address)).to.equal(aliceBegBal+1002);
  });

  it("Receiver Lock & Revert Success", async function () {
    const aliceBegBal = +(await token.balanceOf(alice.address));

    const _id = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1003,
      0
    );

    let transferRecord = {
      id: _id,
      from_chain_id: from_chain_id,
      to_chain_id: to_chain_id,
      from_address: bob.address,
      to_address: alice.address,
      from_token: token.address,
      to_token: token.address,
      amount: 1003,
      state: LOCKED
    }

    // invoke lock event handler
    await bridge.connect(relay).handle_lock(transferRecord);
    await expect(bridge.connect(relay).handle_revert_request(_id))
      .to.emit(bridge, 'RevertResponseEvent')
      .withArgs(_id, REVERTED);
    await expect(bridge.records(_id).state == REVERTED);

    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal);
    expect(await token.balanceOf(alice.address)).to.equal(aliceBegBal);
  });

  it("Receiver Lock & Revert Failure", async function () {
    const aliceBegBal = +(await token.balanceOf(alice.address));

    const _id = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1004,
      0
    );

    let transferRecord = {
      id: _id,
      from_chain_id: from_chain_id,
      to_chain_id: to_chain_id,
      from_address: bob.address,
      to_address: alice.address,
      from_token: token.address,
      to_token: token.address,
      amount: 1004,
      state: LOCKED
    }

    // invoke lock event handler
    await bridge.connect(relay).handle_lock(transferRecord);
    await bridge.connect(alice).release(_id)

    await expect(bridge.connect(relay).handle_revert_request(_id))
      .to.emit(bridge, 'RevertResponseEvent')
      .withArgs(_id, RELEASED);
    await expect(bridge.records(_id).state == RELEASED);

    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal - 1004);
    expect(await token.balanceOf(alice.address)).to.equal(aliceBegBal + 1004);
  });
});
