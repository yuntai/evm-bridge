import { task } from "hardhat/config";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { printTable } from 'console-table-printer';
import { load_config, ChainConfig } from './common';
import { Relayer, RelayConfig } from './relay';

async function print_config(cfg: ChainConfig, hre: any) {
  let getBalance = ((n: Contract | SignerWithAddress) => hre.ethers.provider.getBalance(n.address));
  let getTokenBalance = ((n: Contract | SignerWithAddress) => cfg.token.balanceOf(n.address));

  const tbls = [];
  let k: keyof ChainConfig;
  for (k in cfg) {
    //TODO batch?
    tbls.push({ account: k, address: cfg[k].address, value: await getBalance(cfg[k]), token: await getTokenBalance(cfg[k]) });
  }
  printTable(tbls);
}

async function mine(tx: any) {
  const receipt = await tx.wait();
  if (!receipt.status) console.log('FAILED');
}


task("stat", "A sample task with params")
  .setAction(async (taskArgs, hre) => {
    const ethers = hre.ethers;
    let cfg = await load_config(hre, "./cfg.json", hre.network.name);
    await print_config(cfg, hre);
  });

task("fundToken", "Supply token to others")
  .addParam("account", "account's address")
  .addParam("amount", "amount of tokens to transfer")
  .setAction(async (taskArgs, hre) => {
    const ethers = hre.ethers;
    let cfg = await load_config(hre, "./cfg.json", hre.network.name);
    const fromBal = (await cfg.token.balanceOf(taskArgs.account)).toNumber();
    const tx = await cfg.token.connect(cfg.owner).transfer(taskArgs.account, taskArgs.amount);
    await tx.wait();
    // can be retreived in the events from tx receipt.
    const toBal = (await cfg.token.balanceOf(taskArgs.account)).toNumber();
    console.log(`account(${taskArgs.account}) from ${fromBal} to ${toBal}`)
  });

task("transactionStatus", "transaction status")
  .addParam("id", "id of transaction")
  .setAction(async (taskArgs, hre) => {
    const ethers = hre.ethers;
    let cfg = await load_config(hre, "./cfg.json", hre.network.name);
    const rec = await cfg.bridge.records(taskArgs.id);
    console.log(rec);
  });

task("bridgeStatus", "bridge balance status")
  .setAction(async (taskArgs, hre) => {
    const ethers = hre.ethers;
    let cfg = await load_config(hre, "./cfg.json", hre.network.name);
    console.log("peer balance=", (await cfg.bridge.connect(cfg.owner).peer_balance()).toNumber());
    console.log("token balance=", (await cfg.token.balanceOf(cfg.bridge.address)).toNumber());
  });


task("supplyBridge", "Supply token to bridge from owner")
  .addParam("amount", "amount of tokens")
  .setAction(async (taskArgs, hre) => {
    const ethers = hre.ethers;
    let cfg = await load_config(hre, "./cfg.json", hre.network.name);
    let tx = await cfg.token.connect(cfg.owner).increaseAllowance(cfg.bridge.address, taskArgs.amount);
    console.log(`increase allownce by ${taskArgs.amount} tx(${tx.hash})`)
    await mine(tx);

    tx = await cfg.bridge.connect(cfg.owner).supply(taskArgs.amount);
    console.log(`supply bridge amt(${taskArgs.amount}) tx(${tx.hash})`)
    await mine(tx);
  });

task("launchRelay", "Launc relay")
  .addParam("chain1", "chain1")
  .addParam("chain2", "chain2")
  .setAction(async (taskArgs, hre) => {
    let cfg1 = await load_config(hre, "./cfg.json", taskArgs.chain1);
    let cfg2 = await load_config(hre, "./cfg.json", taskArgs.chain2);

    const cfg: RelayConfig = {
      chain1: taskArgs.chain1,
      chain2: taskArgs.chain2,
      relayOwner1: cfg1.relay,
      relayOwner2: cfg2.relay,
      bridge1: cfg1.bridge,
      bridge2: cfg2.bridge,
    };

    await (new Relayer(cfg, hre).loop());
  });

task("release", "release fund")
  .addParam("account", "account nickname")
  .addParam("id", "id of transaction")
  .setAction(async (taskArgs, hre) => {
    let cfg = await load_config(hre, "./cfg.json", hre.network.name);

    let k: keyof ChainConfig = taskArgs.account;
    const tx = await cfg.bridge.connect(cfg[k]).release(taskArgs.id);
    console.log(`release account(${taskArgs.account}) id(${taskArgs.id}) tx(${tx.hash})`)
    await mine(tx);
  });

task("bridgeLock", "initiaing bridge")
  .addParam("from", "from account (nickname)")
  .addParam("tochain", "to chain name")
  .addParam("toaddress", "to address")
  .addParam("amount", "amount of tokens to bridge")
  .setAction(async (taskArgs, hre) => {
    let cfg1 = await load_config(hre, "./cfg.json", hre.network.name);
    let cfg2 = await load_config(hre, "./cfg.json", taskArgs.tochain);

    let from: keyof ChainConfig = taskArgs.from;
    let tx = await cfg1.token.connect(cfg1[from]).increaseAllowance(cfg1.bridge.address, taskArgs.amount);
    console.log(`increase allownce by ${taskArgs.amount} tx(${tx.hash})`)
    await mine(tx);

    tx = await cfg1.bridge.connect(cfg1[from]).lock(
      100, //TODO: not really checekd anywhere
      taskArgs.toaddress,
      cfg1.token.address,
      cfg2.token.address,
      taskArgs.amount);
    console.log(`lock from(${taskArgs.from}) to_chain(${taskArgs.tochain}) to_address(${taskArgs.toaddress}) amt(${taskArgs.amount}) tx(${tx.hash})`)
    await mine(tx);
  });
