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
    relay: SignerWithAddress,
    relay2: SignerWithAddress,
    relay3: SignerWithAddress, _;

  beforeEach(async function () {
    hre.changeNetwork('hardhat');
    [owner, bob, alice, relay, relay2, relay3, ..._] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Token", "TOK", 18);
    await token.deployed();

    const Bridge = await ethers.getContractFactory("Bridge");
    bridge = await Bridge.deploy(relay.address, token.address);
    await bridge.deployed();

    token.approve(bob.address, 10000);
    token.transfer(bob.address, 10000);

    token.approve(alice.address, 990);
    token.transfer(alice.address, 990);

    token.connect(bob).approve(bridge.address, 10000);

    await token.connect(owner).increaseAllowance(bridge.address, 100000);
    await bridge.supply(100000)
    await (await bridge.connect(relay).handle_supply(10000, 0));
    initialPeerBalance = await bridge.peer_balance();

    token.approve(bridge.address, 10000);
    token.transfer(bridge.address, 10000);

    bridgeBegBal = await token.balanceOf(bridge.address);
    bobBegBal = await token.balanceOf(bob.address);

    to_chain_id = 31337;
    from_chain_id = 31337;
  });

  it("supply", async function() {
      const tx = await bridge.supply(105);
      await expect(tx).to.emit(bridge, 'SupplyEvent').withArgs(105, 1);
  });

  it("kill", async function() {
      const amt = await token.balanceOf(owner.address);
      const amt2 = await token.balanceOf(bridge.address);
      await (await bridge.kill()).wait();
      expect(await token.balanceOf(owner.address)).to.equal(amt.add(amt2));
      expect(await token.balanceOf(bridge.address)).to.equal(0);
  });

  it("handle supply", async function() {
      const peerBalance = (await bridge.peer_balance()).toNumber();
      await (await bridge.connect(relay).handle_supply(106, 1));
      expect((await bridge.peer_balance()).toNumber()).to.equal(peerBalance+106);
  });

  it("relay", async function() {
	await expect(
      		bridge.connect(owner).removeRelay(relay.address)
	).to.be.revertedWith("bridge: at least one relay");
	await expect(
      		bridge.connect(owner).removeRelay(bob.address)
	).to.be.revertedWith("bridge: unknown relay");


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

      await expect(
	      bridge.connect(relay2).handle_lock(transferRecord)
      ).to.be.revertedWith("bridge: only from relay");

      const tx = await bridge.connect(owner).addRelay(relay2.address);
      await tx.wait();

      await bridge.connect(relay2).handle_lock(transferRecord);
      await bridge.connect(owner).removeRelay(relay2.address);

      await expect(
	      bridge.connect(relay2).handle_lock(transferRecord)
      ).to.be.revertedWith("bridge: only from relay");
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
    expect(await bridge.peer_balance()).to.equal(initialPeerBalance.add(1002));
    expect((await bridge.records(_id)).state == TransferState.LOCKED);

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
    const tx = await bridge.connect(owner).supply(101);
    await expect(tx).to.emit(bridge, 'SupplyEvent').withArgs(101, 1);
  });
});
