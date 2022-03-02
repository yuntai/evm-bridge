import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, Signer, BigNumber } from "ethers";
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
  chainId: number | undefined,
  decimals: number
};

describe("Cross Test", function () {
  let chain1: ChainConfig;
  let chain2: ChainConfig;
  let relayer: Relayer;

  async function initialize(chain: string, name: string, symbol: string, decimal: number): Promise<ChainConfig> {
    hre.changeNetwork(chain);
    let accounts = await hre.ethers.getSigners();
    const chainId = ethers.BigNumber.from(await hre.ethers.provider.send('eth_chainId', [])).toNumber();

    const [owner, relayOwner, bob, alice, ..._] = accounts;

    console.log("owner eth balance=", ethers.utils.formatEther(await owner.getBalance()));

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.connect(owner).deploy(name, symbol, decimal);
    await token.deployed();

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = await Bridge.connect(owner).deploy(relayOwner.address, token.address);
    await bridge.deployed();

    const decimals = await token.decimals();

    const chainConfig: ChainConfig = {
      name: chain,
      owner: owner,
      relayOwner: relayOwner,
      bob: bob,
      alice: alice,
      bridge: bridge,
      token: token,
      chainId: chainId,
      decimals: decimals
    }

    await token.connect(owner).approve(bob.address, ethers.utils.parseUnits('10000000', decimals));
    await token.connect(owner).transfer(bob.address, ethers.utils.parseUnits('1000000', decimals));

    await token.connect(owner).approve(alice.address, ethers.utils.parseUnits('1000000', decimals));
    await token.connect(owner).transfer(alice.address, ethers.utils.parseUnits('1000000', decimals));

    await token.connect(owner).approve(bridge.address, ethers.utils.parseUnits('1000000', decimals));

    const provider = bridge.provider;
    // @ts-ignore:next-line
    provider.pollingInterval = 30;

    return chainConfig;
  }

  before(async function () {
    chain1 = await initialize('chain1', 'Token1', 'TOK1', 18);
    chain2 = await initialize('chain2', 'Token2', 'TOK2', 6);

    const relayConfig: RelayConfig = {
      chain1: chain1.name,
      chain2: chain2.name,
      relayOwner1: chain1.relayOwner,
      relayOwner2: chain2.relayOwner,
      bridge1: chain1.bridge,
      bridge2: chain2.bridge,
      decimals1: await chain1.token.decimals(),
      decimals2: await chain2.token.decimals(),
    }

    relayer = new Relayer(relayConfig, hre, true);

    let tx = await chain1.bridge.connect(chain1.owner).supply(ethers.utils.parseUnits('100', chain1.decimals));
    await tx.wait();
    await relayer.flush_events(chain1.name);

    tx = await chain2.bridge.connect(chain2.owner).supply(ethers.utils.parseUnits('100', chain2.decimals));
    await tx.wait();
    await relayer.flush_events(chain2.name);
  });

  it("Lock & Release", async function () {
    // bob on chain1 send token to alice on chain2
    const amt1 = ethers.utils.parseUnits('10', chain1.decimals);
    const amt2 = ethers.utils.parseUnits('10', chain2.decimals);

    await((await chain1.token.connect(chain1.bob).approve(chain1.bridge.address, amt1)).wait());

    const bob_bal = await chain1.token.balanceOf(chain1.bob.address);
    const bridge1_bal = await chain1.token.balanceOf(chain1.bridge.address);
    const bridge1_peer_bal = await chain1.bridge.peer_balance();

    const alice_bal = await chain2.token.balanceOf(chain2.alice.address);
    const bridge2_bal = await chain2.token.balanceOf(chain2.bridge.address);
    const bridge2_peer_bal = await chain2.bridge.peer_balance();

    const tx = await chain1.bridge.connect(chain1.bob).lock(
      chain2.chainId,
      chain2.alice.address,
      chain1.token.address,
      chain2.token.address,
      amt1
    );
    const receipt = await tx.wait();
    const _id = receipt.events.filter((x: any) => { return x.event == "LockEvent" })[0].args[0];

    await relayer.flush_events(chain1.name);

    await((await chain2.bridge.connect(chain2.alice).release(_id)).wait());

    expect((await chain1.bridge.records(_id)).state).to.equal(TransferState.LOCKED);
    expect(await chain1.token.balanceOf(chain1.bridge.address)).to.equal(bridge1_bal.add(amt1));
    expect(await chain1.token.balanceOf(chain1.bob.address)).to.equal(bob_bal.sub(amt1));
    expect(await chain1.bridge.peer_balance()).to.equal(bridge1_peer_bal.sub(amt1));

    expect((await chain2.bridge.records(_id)).state).to.equal(TransferState.RELEASED);
    expect(await chain2.token.balanceOf(chain2.bridge.address)).to.equal(bridge2_bal.sub(amt2));
    expect(await chain2.token.balanceOf(chain2.alice.address)).to.equal(alice_bal.add(amt2));
    expect(await chain2.bridge.peer_balance()).to.equal(bridge2_peer_bal.add(amt2));
  });

  it("Lock & Revert & Redeem", async function () {
    // bob on chain1 send token to alice on chain2
    const amt1 = ethers.utils.parseUnits('11', chain1.decimals);
    const amt2 = ethers.utils.parseUnits('11', chain2.decimals);

    await (await chain1.token.connect(chain1.bob).approve(chain1.bridge.address, amt1)).wait();

    const bob_bal = await chain1.token.balanceOf(chain1.bob.address);
    const bridge1_bal = await chain1.token.balanceOf(chain1.bridge.address);
    const bridge1_peer_bal = await chain1.bridge.peer_balance();

    const alice_bal = await chain2.token.balanceOf(chain2.alice.address);
    const bridge2_bal = await chain2.token.balanceOf(chain2.bridge.address);
    const bridge2_peer_bal = await chain2.bridge.peer_balance();

    const tx = await chain1.bridge.connect(chain1.bob).lock(
      chain2.chainId,
      chain2.alice.address,
      chain1.token.address,
      chain2.token.address,
      amt1
    )
    const receipt = await tx.wait();

    await relayer.flush_events(chain1.name);

    // get _id from the event instead of return value form tx
    const _id = receipt.events.filter((x: any) => { return x.event == "LockEvent" })[0].args[0];

    await (await chain1.bridge.connect(chain1.bob).revert_request(_id)).wait();
    await relayer.flush_events(chain1.name);
    await relayer.flush_events(chain2.name);

    expect((await chain1.bridge.records(_id)).state).to.equal(TransferState.REVERTED);
    expect((await chain2.bridge.records(_id)).state).to.equal(TransferState.REVERTED);


    await((await chain1.bridge.connect(chain1.bob).redeem(_id)).wait())

    expect((await chain1.bridge.records(_id)).state).to.equal(TransferState.REDEEMED);
    expect(await chain1.token.balanceOf(chain1.bridge.address)).to.equal(bridge1_bal);
    expect(await chain1.token.balanceOf(chain1.bob.address)).to.equal(bob_bal);
    expect(await chain1.bridge.peer_balance()).to.equal(bridge1_peer_bal);

    expect((await chain2.bridge.records(_id)).state).to.equal(TransferState.REVERTED);
    expect(await chain2.token.balanceOf(chain2.bridge.address)).to.equal(bridge2_bal);
    expect(await chain2.token.balanceOf(chain2.alice.address)).to.equal(alice_bal);
    expect(await chain2.bridge.peer_balance()).to.equal(bridge2_peer_bal);
  });


  it("Lock & Revert Failure", async function () {
    const amt1 = ethers.utils.parseUnits('12', chain1.decimals);
    const amt2 = ethers.utils.parseUnits('12', chain2.decimals);

    await (await chain1.token.connect(chain1.bob).approve(chain1.bridge.address, amt1)).wait();
    const bob_bal = await chain1.token.balanceOf(chain1.bob.address);
    const bridge1_bal = await chain1.token.balanceOf(chain1.bridge.address);
    const bridge1_peer_bal = await chain1.bridge.peer_balance();

    const alice_bal = await chain2.token.balanceOf(chain2.alice.address);
    const bridge2_bal = await chain2.token.balanceOf(chain2.bridge.address);
    const bridge2_peer_bal = await chain2.bridge.peer_balance();

    const tx = await chain1.bridge.connect(chain1.bob).lock(
      chain2.chainId,
      chain2.alice.address,
      chain1.token.address,
      chain2.token.address,
      amt1)
    const receipt = await tx.wait();

    await relayer.flush_events(chain1.name);

    // get _id from the event instead of return value form tx
    const _id = receipt.events.filter((x: any) => { return x.event == "LockEvent" })[0].args[0];

    await (await chain2.bridge.connect(chain2.alice).release(_id)).wait();

    await (await chain1.bridge.connect(chain1.bob).revert_request(_id)).wait();
    await relayer.flush_events(chain1.name);
    await relayer.flush_events(chain2.name);

    expect((await chain1.bridge.records(_id)).state).to.equal(TransferState.RELEASED);
    expect(await chain1.token.balanceOf(chain1.bridge.address)).to.equal(bridge1_bal.add(amt1));
    expect(await chain1.token.balanceOf(chain1.bob.address)).to.equal(bob_bal.sub(amt1));
    expect(await chain1.bridge.peer_balance()).to.equal(bridge1_peer_bal.sub(amt1));

    expect((await chain2.bridge.records(_id)).state).to.equal(TransferState.RELEASED);
    expect(await chain2.token.balanceOf(chain2.bridge.address)).to.equal(bridge2_bal.sub(amt2));
    expect(await chain2.token.balanceOf(chain2.alice.address)).to.equal(alice_bal.add(amt2));
    expect(await chain2.bridge.peer_balance()).to.equal(bridge2_peer_bal.add(amt2));
  });

  it("deposit", async function () {
    const amt1 = ethers.utils.parseUnits('13', chain1.decimals);
    const amt2 = ethers.utils.parseUnits('13', chain2.decimals);

    await (await chain1.token.connect(chain1.owner).approve(chain1.bridge.address, amt1)).wait();
    const bridge1_bal = await chain1.token.balanceOf(chain1.bridge.address)
    const bridge1_peer_bal = await chain1.bridge.peer_balance();

    const bridge2_bal = await chain2.token.balanceOf(chain2.bridge.address)
    const bridge2_peer_bal = await chain2.bridge.peer_balance();

    const tx = await chain1.bridge.connect(chain1.owner).supply(amt1);
    await tx.wait();

    await relayer.flush_events(chain1.name);

    expect(await chain1.token.balanceOf(chain1.bridge.address)).to.equal(bridge1_bal.add(amt1));

    expect((await chain2.bridge.peer_balance()).toNumber()).to.equal(bridge2_peer_bal.add(amt2));
  });
});
