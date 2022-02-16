const { expect } = require("chai");
const { ethers } = require("hardhat");
const { soliditySha3 } = require("web3-utils");
const { Relayer } = require("./relay");

// Bridge.TransferState Enum
const TransferState = {
  LOCKED: 0,
  REVERT_REQUESTED: 1,
  REVERTED: 2,
  REDEEMED: 3,
  RELEASED: 4
}

describe("Cross Test", function () {
  let chain1;
  let chain2;
  let relay;

  async function initialize(config) {
    const [owner, bob, alice, ..._] = config.accounts;

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.connect(owner).deploy();
    await token.deployed();

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = await Bridge.connect(owner).deploy(relay.address, token.address);
    await bridge.deployed();

    //TODO: access env?
    config['chainId'] = 31337;

    config['owner'] = owner;
    config['bob'] = bob;
    config['alice'] = alice;

    config['token'] = token;
    config['bridge'] = bridge;

    //console.log("owner=", owner.address);
    //console.log("bob=", bob.address);
    //console.log("alice=", alice.address);
    //console.log("token=", token.address);
    //console.log("bridge=", bridge.address);

    token.connect(owner).approve(bob.address, 10000);
    token.connect(owner).transfer(bob.address, 10000);

    token.connect(owner).approve(bridge.address, 10000);
    token.connect(owner).transfer(bridge.address, 10000);

    await bridge.setPeerBalance(100000);

    const provider = bridge.provider;
    provider.pollingInterval = 10;
  }

  beforeEach(async function() {
    chain1 = {name: 'chain1'};
    chain2 = {name: 'chain2'};

    // 20 accounts same for both chains
    let accounts = await ethers.getSigners();

    relay = accounts[1];

    accounts = accounts.slice(2, 20);

    chain1.accounts = accounts.slice(0,9);
    chain2.accounts = accounts.slice(9);

    hre.changeNetwork('chain1');
    await initialize(chain1);

    hre.changeNetwork('chain2');
    await initialize(chain2);

    relayer = new Relayer(relay, {[chain1.name]: chain1.bridge, [chain2.name]: chain2.bridge});
  });

  it("Lock & Release", async function () {
    // bob on chain1 send token to alice on chain2

    hre.changeNetwork('chain1');
    await chain1.token.connect(chain1.bob).approve(chain1.bridge.address, 10000);

    const bob_bal = +(await chain1.token.balanceOf(chain1.bob.address));
    const bridge1_bal = +(await chain1.token.balanceOf(chain1.bridge.address));
    const bridge1_peer_bal = +(await chain1.bridge.peer_balance());

    hre.changeNetwork('chain2');
    const alice_bal = +(await chain2.token.balanceOf(chain2.alice.address));
    const bridge2_bal = +(await chain2.token.balanceOf(chain2.bridge.address));
    const bridge2_peer_bal = +(await chain2.bridge.peer_balance());

    hre.changeNetwork('chain1');
    const tx = await chain1.bridge.connect(chain1.bob).lock(
      chain2.chainId,
      chain2.alice.address,
      chain1.token.address,
      chain2.token.address,
      1000)
    const receipt = await tx.wait();

    await relayer.flush_events('chain1');

    const _id = receipt.events.filter((x) => {return x.event == "LockEvent"})[0].args[0];

    hre.changeNetwork('chain2');
    await chain2.bridge.connect(chain2.alice).release(_id);

    hre.changeNetwork('chain1');
    expect((await chain1.bridge.records(_id)).state).to.equal(TransferState.LOCKED);
    expect(await chain1.token.balanceOf(chain1.bridge.address)).to.equal(bridge1_bal + 1000);
    expect(await chain1.token.balanceOf(chain1.bob.address)).to.equal(bob_bal - 1000);
    expect(await chain1.bridge.peer_balance()).to.equal(bridge1_peer_bal - 1000);

    hre.changeNetwork('chain2');
    expect((await chain2.bridge.records(_id)).state).to.equal(TransferState.RELEASED);
    expect(await chain2.token.balanceOf(chain2.bridge.address)).to.equal(bridge2_bal - 1000);
    expect(await chain2.token.balanceOf(chain2.alice.address)).to.equal(alice_bal + 1000);
    expect(await chain2.bridge.peer_balance()).to.equal(bridge2_peer_bal + 1000);
  });

  it("Lock & Revert & Redeem", async function () {
    // bob on chain1 send token to alice on chain2

    hre.changeNetwork('chain1');
    await chain1.token.connect(chain1.bob).approve(chain1.bridge.address, 10000);

    const bob_bal = +(await chain1.token.balanceOf(chain1.bob.address));
    const bridge1_bal = +(await chain1.token.balanceOf(chain1.bridge.address));
    const bridge1_peer_bal = +(await chain1.bridge.peer_balance());

    hre.changeNetwork('chain2');
    const alice_bal = +(await chain2.token.balanceOf(chain2.alice.address));
    const bridge2_bal = +(await chain2.token.balanceOf(chain2.bridge.address));
    const bridge2_peer_bal = +(await chain2.bridge.peer_balance());

    const tx = await chain1.bridge.connect(chain1.bob).lock(
      chain2.chainId,
      chain2.alice.address,
      chain1.token.address,
      chain2.token.address,
      1001)
    const receipt = await tx.wait();

    await relayer.flush_events('chain1');

    // get _id from the event instead of return value form tx
    const _id = receipt.events.filter((x) => {return x.event == "LockEvent"})[0].args[0];

    await chain1.bridge.connect(chain1.bob).revert_request(_id);
    await relayer.flush_events('chain1');
    await relayer.flush_events('chain2');

    expect((await chain1.bridge.records(_id)).state).to.equal(TransferState.REVERTED);
    expect((await chain2.bridge.records(_id)).state).to.equal(TransferState.REVERTED);

    hre.changeNetwork('chain1');

    await chain1.bridge.connect(chain1.bob).redeem(_id);

    hre.changeNetwork('chain1');
    expect((await chain1.bridge.records(_id)).state).to.equal(TransferState.REDEEMED);
    expect(await chain1.token.balanceOf(chain1.bridge.address)).to.equal(bridge1_bal);
    expect(await chain1.token.balanceOf(chain1.bob.address)).to.equal(bob_bal);
    expect(await chain1.bridge.peer_balance()).to.equal(bridge1_peer_bal);

    hre.changeNetwork('chain2');
    expect((await chain2.bridge.records(_id)).state).to.equal(TransferState.REVERTED);
    expect(await chain2.token.balanceOf(chain2.bridge.address)).to.equal(bridge2_bal);
    expect(await chain2.token.balanceOf(chain2.alice.address)).to.equal(alice_bal);
    expect(await chain2.bridge.peer_balance()).to.equal(bridge2_peer_bal);
  });

  it("Lock & Revert Failure", async function () {
    hre.changeNetwork('chain1');
    await chain1.token.connect(chain1.bob).approve(chain1.bridge.address, 10000);
    const bob_bal = +(await chain1.token.balanceOf(chain1.bob.address));
    const bridge1_bal = +(await chain1.token.balanceOf(chain1.bridge.address));
    const bridge1_peer_bal = +(await chain1.bridge.peer_balance());

    hre.changeNetwork('chain2');
    const alice_bal = +(await chain2.token.balanceOf(chain2.alice.address));
    const bridge2_bal = +(await chain2.token.balanceOf(chain2.bridge.address));
    const bridge2_peer_bal = +(await chain2.bridge.peer_balance());

    hre.changeNetwork('chain1');

    const tx = await chain1.bridge.connect(chain1.bob).lock(
      chain2.chainId,
      chain2.alice.address,
      chain1.token.address,
      chain2.token.address,
      1001)
    const receipt = await tx.wait();

    await relayer.flush_events('chain1');

    // get _id from the event instead of return value form tx
    const _id = receipt.events.filter((x) => {return x.event == "LockEvent"})[0].args[0];

    hre.changeNetwork('chain2');
    await chain2.bridge.connect(chain2.alice).release(_id);

    hre.changeNetwork('chain1');
    await chain1.bridge.connect(chain1.bob).revert_request(_id);
    await relayer.flush_events('chain1');
    await relayer.flush_events('chain2');

    hre.changeNetwork('chain1');
    expect((await chain1.bridge.records(_id)).state).to.equal(TransferState.RELEASED);
    expect(await chain1.token.balanceOf(chain1.bridge.address)).to.equal(bridge1_bal + 1001);
    expect(await chain1.token.balanceOf(chain1.bob.address)).to.equal(bob_bal - 1001);
    expect(await chain1.bridge.peer_balance()).to.equal(bridge1_peer_bal - 1001);

    hre.changeNetwork('chain2');
    expect((await chain2.bridge.records(_id)).state).to.equal(TransferState.RELEASED);
    expect(await chain2.token.balanceOf(chain2.bridge.address)).to.equal(bridge2_bal - 1001);
    expect(await chain2.token.balanceOf(chain2.alice.address)).to.equal(alice_bal + 1001);
    expect(await chain2.bridge.peer_balance()).to.equal(bridge2_peer_bal + 1001);
  });
});
