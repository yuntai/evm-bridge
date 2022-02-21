import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers, config as hreConfig } from "hardhat";
import { Relayer, RelayConfig } from "../tasks/relay";
import { TransferState } from "../tasks/common";
import hre from 'hardhat';

interface ChainConfig {
  name: string,
  owner: SignerWithAddress,
  relayOwner: SignerWithAddress,
  bob: SignerWithAddress,
  alice: SignerWithAddress,
  bridge: Contract,
  token: Contract,
  chainId: number | undefined
};

describe("Cross Test", function () {
  let chain1: ChainConfig;
  let chain2: ChainConfig;
  let relayer: Relayer;

  async function initialize(chain: string, accounts: SignerWithAddress[]): Promise<ChainConfig> {
    hre.changeNetwork(chain);

    const [owner, relayOwner, bob, alice, ..._] = accounts;

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.connect(owner).deploy();
    await token.deployed();

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = await Bridge.connect(owner).deploy(relayOwner.address, token.address);
    await bridge.deployed();

    const chainConfig: ChainConfig = {
      name: chain,
      owner: owner,
      relayOwner: relayOwner,
      bob: bob,
      alice: alice,
      bridge: bridge,
      token: token,
      chainId: 31337
    }

    await token.connect(owner).approve(bob.address, 10000);
    await token.connect(owner).transfer(bob.address, 10000);

    await token.connect(owner).approve(bridge.address, 100000);

    const provider = bridge.provider;
    // @ts-ignore:next-line
    provider.pollingInterval = 30;

    return chainConfig;
  }

  beforeEach(async function () {
    // 20 accounts same for both chains
    let accounts = await ethers.getSigners();

    chain1 = await initialize('chain1', accounts.slice(0, 9));
    chain2 = await initialize('chain2', accounts.slice(9));

    const relayConfig: RelayConfig = {
      chain1: 'chain1',
      chain2: 'chain2',
      relayOwner1: chain1.relayOwner,
      relayOwner2: chain2.relayOwner,
      bridge1: chain1.bridge,
      bridge2: chain2.bridge
    }

    relayer = new Relayer(relayConfig, hre, true);

    hre.changeNetwork('chain1');
    let tx = await chain1.bridge.connect(chain1.owner).supply(100000);
    await tx.wait();
    await relayer.flush_events('chain1');

    hre.changeNetwork('chain2');
    tx = await chain2.bridge.connect(chain2.owner).supply(100000);
    await tx.wait();
    await relayer.flush_events('chain2');
  });

  it("Lock & Release", async function () {
    // bob on chain1 send token to alice on chain2

    hre.changeNetwork('chain1');
    await chain1.token.connect(chain1.bob).approve(chain1.bridge.address, 10000);

    const bob_bal = (await chain1.token.balanceOf(chain1.bob.address)).toNumber();
    const bridge1_bal = (await chain1.token.balanceOf(chain1.bridge.address)).toNumber();
    const bridge1_peer_bal = (await chain1.bridge.peer_balance()).toNumber();

    hre.changeNetwork('chain2');
    const alice_bal = (await chain2.token.balanceOf(chain2.alice.address)).toNumber();
    const bridge2_bal = (await chain2.token.balanceOf(chain2.bridge.address)).toNumber();
    const bridge2_peer_bal = (await chain2.bridge.peer_balance()).toNumber();

    hre.changeNetwork('chain1');
    const tx = await chain1.bridge.connect(chain1.bob).lock(
      chain2.chainId,
      chain2.alice.address,
      chain1.token.address,
      chain2.token.address,
      1000);
    const receipt = await tx.wait();
    const _id = receipt.events.filter((x: any) => { return x.event == "LockEvent" })[0].args[0];

    await relayer.flush_events('chain1');

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
    const _id = receipt.events.filter((x: any) => { return x.event == "LockEvent" })[0].args[0];

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
    const _id = receipt.events.filter((x: any) => { return x.event == "LockEvent" })[0].args[0];

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

  it("deoposit", async function () {
    hre.changeNetwork('chain1');
    await chain1.token.connect(chain1.owner).approve(chain1.bridge.address, 10000);
    const bridge1_bal = (await chain1.token.balanceOf(chain1.bridge.address)).toNumber();
    const bridge1_peer_bal = (await chain1.bridge.peer_balance()).toNumber();

    hre.changeNetwork('chain2');
    const bridge2_bal = (await chain2.token.balanceOf(chain2.bridge.address)).toNumber();
    const bridge2_peer_bal = (await chain2.bridge.peer_balance()).toNumber();

    hre.changeNetwork('chain1');
    const tx = await chain1.bridge.connect(chain1.owner).supply(121);
    await tx.wait();

    await relayer.flush_events('chain1');

    expect(await chain1.token.balanceOf(chain1.bridge.address)).to.equal(bridge1_bal + 121);

    hre.changeNetwork('chain2');
    expect((await chain2.bridge.peer_balance()).toNumber()).to.equal(bridge2_peer_bal + 121);
  });
});
