import { expect } from "chai";
import { ethers } from "hardhat";
import { soliditySha3 } from "web3-utils";
import hre from 'hardhat';
import { Contract, BigNumber } from "ethers";
import { TransferState } from "./relay"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

//TODO: more negative test case
//      check against onlyOwner, onlyRelay, to_address, from_address
//      peer balance

async function getTimestamp() {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  return blockBefore.timestamp;
}

describe("Single-sided", function () {
  let token: Contract;
  let bridge: Contract;
  let to_chain_id: number,
    from_chain_id: number;

  let bridgeBegBal: BigNumber;
  let bobBegBal: BigNumber;
  let initialPeerBalance: BigNumber;

  let owner: SignerWithAddress,
    bob: SignerWithAddress,
    alice: SignerWithAddress,
    relay: SignerWithAddress, _;

  beforeEach(async function () {
    hre.changeNetwork('hardhat');
    [owner, bob, alice, relay, ..._] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy();
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
    initialPeerBalance = await bridge.peer_balance();

    token.approve(bridge.address, 10000);
    token.transfer(bridge.address, 10000);

    bridgeBegBal = await token.balanceOf(bridge.address);
    bobBegBal = await token.balanceOf(bob.address);

    to_chain_id = 7777;
    from_chain_id = 31337; // hardhat default chain id; TODO: how to access network config here
  });

  it("Sender Lock", async function () {
    const tx = await bridge.connect(bob).lock(to_chain_id, alice.address, token.address, token.address, 1000);
    await tx.wait();

    const expectedId = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1000,
      0,
      await getTimestamp()
    );

    await expect(tx).to.emit(bridge, 'LockEvent').withArgs(expectedId);
    expect((await bridge.records(expectedId)).state).to.equal(TransferState.LOCKED);
    expect(await bridge.peer_balance()).to.equal(initialPeerBalance.sub(1000));
    expect(await token.balanceOf(bob.address)).to.equal(bobBegBal.sub(1000));
    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal.add(1000));
  });

  it("Sender Lock & Revert", async function () {
    const tx = await bridge.connect(bob).lock(to_chain_id, alice.address, token.address, token.address, 1001);
    await tx.wait();

    const _id = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1001,
      0,
      await getTimestamp()
    );
    await expect(bridge.connect(bob).revert_request(_id)).to.emit(bridge, 'RevertRequestEvent').withArgs(_id);
    await expect(bridge.records(_id).state == TransferState.REVERT_REQUESTED);

    // event push
    await bridge.connect(relay).handle_revert_response(_id, TransferState.REVERTED);
    await expect(bridge.records(_id).state == TransferState.REVERTED);
    // peer balance restored
    expect(await bridge.peer_balance()).to.equal(initialPeerBalance);
  });

  it("Sender Lock & Revert & Redeem", async function () {
    const tx = await bridge.connect(bob).lock(to_chain_id, alice.address, token.address, token.address, 1002)
    await tx.wait();

    const _id = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token.address, token.address,
      1002,
      0,
      await getTimestamp()
    );

    await bridge.connect(bob).revert_request(_id);

    // event push
    await bridge.connect(relay).handle_revert_response(_id, TransferState.REVERTED);

    //await bridge.redeem(_id); TODO: raise
    await bridge.connect(bob).redeem(_id);
    await expect(bridge.records(_id).state == TransferState.REDEEMED);

    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal);
    expect(await token.balanceOf(bob.address)).to.equal(bobBegBal);
  });

  it("Receiver Lock & Release", async function () {
    const aliceBegBal: BigNumber = await token.balanceOf(alice.address);

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
      state: TransferState.LOCKED
    }

    // invoke lock event handler
    await bridge.connect(relay).handle_lock(transferRecord);
    const x = await bridge.peer_balance()
    expect(await bridge.peer_balance()).to.equal(initialPeerBalance.add(1002));
    await expect(bridge.records(_id).state == TransferState.LOCKED);

    await bridge.connect(alice).release(_id)

    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal.sub(1002));
    expect(await token.balanceOf(alice.address)).to.equal(aliceBegBal.add(1002));
  });

  it("Receiver Lock & Revert Success", async function () {
    const aliceBegBal: BigNumber = await token.balanceOf(alice.address);

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
      state: TransferState.LOCKED
    }

    // invoke lock event handler
    await bridge.connect(relay).handle_lock(transferRecord);
    await expect(bridge.connect(relay).handle_revert_request(_id))
      .to.emit(bridge, 'RevertResponseEvent')
      .withArgs(_id, TransferState.REVERTED);
    await expect(bridge.records(_id).state == TransferState.REVERTED);

    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal);
    expect(await token.balanceOf(alice.address)).to.equal(aliceBegBal);
  });

  it("Receiver Lock & Revert Failure", async function () {
    const aliceBegBal: BigNumber = await token.balanceOf(alice.address);

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
      state: TransferState.LOCKED
    }

    // invoke lock event handler
    await bridge.connect(relay).handle_lock(transferRecord);
    await bridge.connect(alice).release(_id)

    await expect(bridge.connect(relay).handle_revert_request(_id))
      .to.emit(bridge, 'RevertResponseEvent')
      .withArgs(_id, TransferState.RELEASED);
    await expect(bridge.records(_id).state == TransferState.RELEASED);

    expect(await token.balanceOf(bridge.address)).to.equal(bridgeBegBal.sub(1004));
    expect(await token.balanceOf(alice.address)).to.equal(aliceBegBal.add(1004));
  });

  it("fund peer", async function () {
    const tx = await bridge.connect(owner).deposit(101);
    await expect(tx).to.emit(bridge, 'DepositEvent').withArgs(101);
  });
});
