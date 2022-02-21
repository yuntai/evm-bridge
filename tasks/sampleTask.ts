import { task } from "hardhat/config";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadConfig, saveConfig, printConfig, ChainConfig, TransferState, getStateName } from './common';
import { Relayer, RelayConfig } from './relay';

//TODO: gas fee
//TODO: tx cancellation
//TODO: gas consumtion analysis

function getAddress(cfg: ChainConfig, _k: any): any {
  let k: keyof ChainConfig = _k;
  return k in cfg ? cfg[k]?.address : _k;
}

// BSC: 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d
// https://bscscan.com/token/0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d
// Polygon: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 (proxy?)
// 0xDD9185DB084f5C4fFf3b4f70E7bA62123b812226

// deploy existing token (e.g. USDC)
// TODO: not working!
task("setTokenAddress")
  .addParam("chain", "chain")
  .addParam("address", "set token address")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    hre.changeNetwork(taskArgs.chain);
    const token = await hre.ethers.getContractAt("ERC20", taskArgs.address);
    console.log("token address:", token.address);
    console.log(`name: ${await token.name()}`);
    console.log(await token.balanceOf(cfg.owner.address));
    //console.log(`symbol: ${await token.symbol()}`);
    //console.log("total supply:", hre.ethers.utils.formatUnits(await token.totalSupply()));
    cfg.token = token;
    saveConfig(cfg, taskArgs.chain);
  });

// deploy our token
task("deployToken")
  .addParam("chain", "chain")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    hre.changeNetwork(taskArgs.chain);
    const Token = await hre.ethers.getContractFactory("Token");
    const token = await Token.connect(cfg.owner).deploy();
    await token.deployed();
    console.log("new token address:", token.address);
    cfg.token = token;
    saveConfig(cfg, taskArgs.chain);
  });

// 2,849,459 gas
task("deployBridge")
  .addParam("chain", "chain")
  .addOptionalParam('token', 'token address')
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    taskArgs.token ||= cfg.token.address;

    hre.changeNetwork(taskArgs.chain);
    console.log(`deploying Bridge to ${taskArgs.chain}`);
    const Bridge = await hre.ethers.getContractFactory("Bridge");
    const bridge = await Bridge.connect(cfg.owner).deploy(cfg.relayOwner.address, taskArgs.token);
    const receipt = await bridge.deployed();
    cfg.bridge = bridge;
    console.log("new bridge address:", bridge.address);
    saveConfig(cfg, taskArgs.chain);
  });

task("stat", "show network account status")
  .addParam("chain", "chain")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    await printConfig(cfg, hre);
    if (cfg.bridge) {
      const token_address = await cfg.bridge.token();
      const relay_address = await cfg.bridge.relay();
      console.log("bridge configuration")
      console.log("--------------------")
      console.log("token address:", token_address);
      console.log("relay owner:", relay_address);
      console.log("peer balance:", (await cfg.bridge.connect(cfg.owner).peer_balance()).toNumber());
    }
  });

task("sendToken", "Send token from owner to others")
  .addParam('chain', 'chain')
  .addParam("to", "nickname(relayOnwer, bob or alice) or address")
  .addParam("amount", "amount of tokens to transfer")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    const to = getAddress(cfg, taskArgs.to);
    const fromBal = await cfg.token.balanceOf(to);
    const tx = await cfg.token.connect(cfg.owner).transfer(to, taskArgs.amount);
    await tx.wait();
    // can be retreived in the events from tx receipt.
    const toBal = await cfg.token.balanceOf(to);
    console.log(`account(${to}) from ${fromBal.toString()} to ${toBal.toString()}`)
  });

task("sendEther", "Send ether from owner to others")
  .addParam('chain', 'chain')
  .addParam("to", "nickname(relayOnwer, bob or alice) or address")
  .addParam("amount", "amount of ether")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    const to = getAddress(cfg, taskArgs.to);
    let fromBal = await hre.ethers.provider.getBalance(to);

    const tx = await cfg.owner.sendTransaction({
      to: to,
      value: hre.ethers.BigNumber.from(taskArgs.amount)
    });
    console.log(`sending ehter tx(${tx.hash})`)
    console.log(`  from ${taskArgs.to}(${cfg.owner.address})`)
    console.log(`  to ${taskArgs.to}(${to})`)
    await tx.wait();
    let toBal = await hre.ethers.provider.getBalance(to);
    console.log(`balance from ${fromBal.toString()} to ${toBal.toString()}`)
  });

task("txStatus", "transaction status")
  .addParam("chain", "chain")
  .addParam("id", "id of transaction")
  .setAction(async (taskArgs, hre) => {
    hre.changeNetwork(taskArgs.chain);
    let cfg = await loadConfig(hre, taskArgs.chain);
    const rec = await cfg.bridge.records(taskArgs.id);
    console.log("STATE:", getStateName(rec.state));
    console.log(rec);
  });

task("supplyBridge", "Supply token to bridge from owner")
  .addParam("chain", "chain")
  .addParam("amount", "amount of tokens")
  .setAction(async (taskArgs, hre) => {
    const ethers = hre.ethers;
    let cfg = await loadConfig(hre, taskArgs.chain);
    let tx = await cfg.token.connect(cfg.owner).increaseAllowance(cfg.bridge.address, taskArgs.amount);
    console.log(`increase allownce by ${taskArgs.amount} tx(${tx.hash})`)
    await tx.wait();

    tx = await cfg.bridge.connect(cfg.owner).supply(taskArgs.amount);
    console.log(`supply bridge amt(${taskArgs.amount}) tx(${tx.hash})`)
    await tx.wait();
  });

task("launchRelay", "Launc relay")
  .addParam("chain1", "chain1")
  .addParam("chain2", "chain2")
  .setAction(async (taskArgs, hre) => {
    let cfg1 = await loadConfig(hre, taskArgs.chain1);
    let cfg2 = await loadConfig(hre, taskArgs.chain2);

    const cfg: RelayConfig = {
      chain1: taskArgs.chain1,
      chain2: taskArgs.chain2,
      relayOwner1: cfg1.relayOwner,
      relayOwner2: cfg2.relayOwner,
      bridge1: cfg1.bridge,
      bridge2: cfg2.bridge,
    };

    await (new Relayer(cfg, hre).loop());
  });

task("release", "release fund")
  .addParam("chain", "chain")
  .addParam("account", "account nickname(alice|bob)")
  .addParam("id", "id of transaction")
  .setAction(async (taskArgs, hre) => {
    hre.changeNetwork(taskArgs.chain);
    let cfg = await loadConfig(hre, taskArgs.chain);
    let k: keyof ChainConfig = taskArgs.account;
    const tx = await cfg.bridge.connect(cfg[k]).release(taskArgs.id);
    console.log(`[RELEASE] chain(${taskArgs.chain}) account(${taskArgs.account}) id(${taskArgs.id}) tx(${tx.hash})`)
    await tx.wait();
  });

task("lock", "initiaing bridge transaction")
  .addParam("fromchain", "from chain name")
  .addParam("from", "from account nickname(alice|bob)")
  .addParam("tochain", "to chain name")
  .addParam("to", "address|nickname(alice|bob)")
  .addParam("amount", "amount of tokens to bridge")
  .setAction(async (taskArgs, hre) => {
    hre.changeNetwork(taskArgs.fromchain);

    let cfg1 = await loadConfig(hre, taskArgs.fromchain);
    let cfg2 = await loadConfig(hre, taskArgs.tochain);

    let from: keyof ChainConfig = taskArgs.from;
    let tx = await cfg1.token.connect(cfg1[from]).increaseAllowance(cfg1.bridge.address, taskArgs.amount);
    console.log(`increase allownce by ${taskArgs.amount} tx(${tx.hash})`)
    await tx.wait();

    const toAddress = getAddress(cfg2, taskArgs.to);
    tx = await cfg1.bridge.connect(cfg1[from]).lock(
      100, //HACK: not really checked anywhere // TODO: proper
      toAddress,
      cfg1.token.address,
      cfg2.token.address,
      taskArgs.amount);
    console.log(`[LOCK] from_chain(${taskArgs.fromchain}) from(${taskArgs.from}) to_chain(${taskArgs.tochain}) to(${taskArgs.to}) amt(${taskArgs.amount}) tx(${tx.hash})`)
    let receipt;
    try {
      receipt = await tx.wait();
    } catch (err) {
      //// TODO: revert reason retreival
      console.log('FAILED...');
      // @ts-ignore
      console.log(err.receipt);
      return;
    }
    const _id = receipt.events.filter((x: any) => { return x.event == "LockEvent" })[0].args[0];
    console.log(`  => id(${_id})`);
  });

task("revert", "initiaing revert operation")
  .addParam("chain", "chain")
  .addParam("account", "from account (nickname)")
  .addParam("id", "id of bridge record")
  .setAction(async (taskArgs, hre) => {
    let cfg1 = await loadConfig(hre, taskArgs.chain)

    let account: keyof ChainConfig = taskArgs.account;
    const tx = await cfg1.bridge.connect(cfg1[account]).revert_request(taskArgs.id);
    console.log(`[REVERT_REQUEST] from(${taskArgs.account}) id(${taskArgs.id}) tx(${tx.hash})`)
    await tx.wait();
  });

task("redeem", "redeem operation")
  .addParam("chain", "chain")
  .addParam("account", "from account (nickname)")
  .addParam("id", "id of bridge record")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);

    let account: keyof ChainConfig = taskArgs.account;
    const tx = await cfg.bridge.connect(cfg[account]).redeem(taskArgs.id);
    console.log(`[REDEEM] from(${taskArgs.account}) id(${taskArgs.id}) tx(${tx.hash})`)
    await tx.wait();
  });
