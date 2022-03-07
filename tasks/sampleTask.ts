import { task } from "hardhat/config";
import { loadConfig, saveConfig, printConfig, ChainConfig, TransferState, getStateName, IERC20_ABI } from './common';
import { Relayer, RelayConfig } from './relay';
import { addRecord, dumpRecords } from "./db";

//TODO: gas fee
//TODO: tx cancellation
//TODO: gas consumtion analysis

function getAddress(cfg: ChainConfig, _k: any): any {
  let k: keyof ChainConfig = _k;
  return k in cfg ? cfg[k]?.address : _k;
}

// USDC token addresses
// bsc: 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d (proxy)
// bsc_test: 0x64544969ed7EBf5f083679233325356EbE738930 (no proxy)
// polygon: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 (decimals: 6)
// mumbai: 0xdA5289fCAAF71d52a80A254da614a192b693e977 (proxy)
//         (0x0Ad647080846C90dfF78893e06fa1d48b0e56982)
// rinkeby: 0x4DBCdF9B62e891a7cec5A2568C3F4FAF9E8Abe2b

task("checkTokenUsingLowLevel")
  .addParam("chain", "chain")
  .addParam("address", "token address")
  .setAction(async (taskArgs, hre) => {
    const ethers = hre.ethers;
    let cfg = await loadConfig(hre, taskArgs.chain);
    hre.changeNetwork(taskArgs.chain);

    let iface = new ethers.utils.Interface(IERC20_ABI);
    for (let n of ["name", "symbol", "decimals"]) {
      let data = iface.encodeFunctionData(n);
      let tx = { to: taskArgs.address, data: data }
      let res = await ethers.provider.call(tx);
      console.log(`${n}: `, iface.decodeFunctionResult(n, res));
    }
    const n = "balanceOf";
    let data = iface.encodeFunctionData(n, [cfg.owner.address]);
    let tx = { to: taskArgs.address, data: data }
    let res = await ethers.provider.call(tx);
    console.log(`${n}: `, iface.decodeFunctionResult(n, res));
  });

task("checkToken")
  .addParam("chain", "chain")
  .addParam("address", "token address")
  .setAction(async (taskArgs, hre) => {
    hre.changeNetwork(taskArgs.chain);
    let cfg = await loadConfig(hre, taskArgs.chain);
    const ethers = hre.ethers;
    const token = await hre.ethers.getContractAt(IERC20_ABI, taskArgs.address);

    console.log(await token.decimals());
    console.log(await token.name());
    console.log(await token.symbol());
    console.log(await token.balanceOf(cfg.owner.address));
  });


// deploy existing token (e.g. USDC)
task("setToken")
  .addParam("chain", "chain")
  .addParam("address", "set token address")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    hre.changeNetwork(taskArgs.chain);
    const token = await hre.ethers.getContractAt(IERC20_ABI, taskArgs.address);
    console.log("address:", token.address);
    console.log(`name: ${await token.name()}`);
    console.log(`symbol: ${await token.symbol()}`);
    console.log(`decimals: ${await token.decimals()}`);
    cfg.token = token;
    saveConfig(cfg, taskArgs.chain);
  });

// deploy test token
task("deployTestToken")
  .addParam("chain", "chain")
  .addParam("name", "token name")
  .addParam("symbol", "token symbol")
  .addParam("decimals", "decimal")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    hre.changeNetwork(taskArgs.chain);
    const Token = await hre.ethers.getContractFactory("Token");
    const token = await Token.connect(cfg.owner).deploy(taskArgs.name, taskArgs.symbol, taskArgs.decimals);
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
    taskArgs.token ||= cfg.token?.address;

    hre.changeNetwork(taskArgs.chain);
    console.log(`deploying Bridge to ${taskArgs.chain}`);
    const Bridge = await hre.ethers.getContractFactory("Bridge");
    const bridge = await Bridge.connect(cfg.owner).deploy(cfg.relay1.address, taskArgs.token);
    const receipt = await bridge.deployed();
    cfg.bridge = bridge;
    console.log("new bridge address:", bridge.address);
    await (await bridge.addRelay(cfg.relay2.address)).wait();
    await (await bridge.addRelay(cfg.relay3.address)).wait();

    saveConfig(cfg, taskArgs.chain);
  });

/*
task("manualRelease")
  .setAction(async (taskArgs, hre) => {
    let cfg1 = await loadConfig(hre, 'polygon');
    let cfg2 = await loadConfig(hre, 'bsc');
    const amount = '10000000000000000000';

    const bob = cfg1.bob;
    const alice = cfg2.alice;
    const token1 = cfg1.token;
    const token2 = cfg2.token;
    const from_chain_id = 137; // polygon
    const to_chain_id = 56; // bsc

    const blockNumBefore = await hre.ethers.provider.getBlockNumber();
    const blockBefore = await hre.ethers.provider.getBlock(blockNumBefore);
    const timestamp = blockBefore.timestamp;

    const _id = soliditySha3(
      from_chain_id, to_chain_id,
      bob.address, alice.address,
      token1.address, token2.address,
      amount,
      TransferState.LOCKED,
      timestamp
    );
    console.log("_id:", _id);

    let transferRecord = {
      id: _id,
      from_chain_id: from_chain_id,
      to_chain_id: to_chain_id,
      from_address: bob.address,
      to_address: alice.address,
      from_token: token1.address,
      to_token: token2.address,
      amount: hre.ethers.BigNumber.from(amount),
      state: TransferState.LOCKED
    }
    console.log(transferRecord);

    hre.changeNetwork('bsc');
    const tx = await cfg2.bridge.connect(cfg2.relayOwner).handle_lock(transferRecord);
    await tx.wait();
  });
*/

task("stat", "show network account status")
  .addParam("chain", "chain")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    await printConfig(cfg, hre);
    if (cfg.bridge) {
      const token_address = await cfg.bridge.token();
      const dec = await cfg.token.decimals();
      //const relay_address = await cfg.bridge.relay();
      console.log("bridge configuration")
      console.log("--------------------")
      console.log("token address:", token_address);
      const bal = await cfg.bridge.connect(cfg.owner).peer_balance();
      console.log("decimals:", dec.toString());
      const x = hre.ethers.utils.formatUnits(bal.toString(), dec);
      console.log("peer balance:", `${bal.toString()} (${x})`);
    }
  });

task("sendToken", "Send token from owner to others")
  .addParam('chain', 'chain')
  .addOptionalParam('from', 'nickname(owner, bob, alice)')
  .addParam("to", "nickname(owner, relayOnwer, bob or alice) or address")
  .addParam("amount", "amount of tokens to transfer")
  .setAction(async (taskArgs, hre) => {
    let cfg = await loadConfig(hre, taskArgs.chain);
    let k: keyof ChainConfig = taskArgs.from || 'owner' as keyof ChainConfig;
    let from = cfg[k];
    const decimals = await cfg.token.decimals(); //TODO(PERF)
    const amt = hre.ethers.utils.parseUnits(taskArgs.amount, decimals);

    from = getAddress(cfg, from);
    const to = getAddress(cfg, taskArgs.to);
    const fromBal = await cfg.token?.balanceOf(to);
    const tx = await cfg.token?.connect(from).transfer(to, amt);
    await tx.wait();
    // can be retreived in the events from tx receipt.
    const toBal = await cfg.token?.balanceOf(to);
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
    console.log(`  from owner(${cfg.owner.address})`)
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
  .addParam("amount", "amount of tokens in units (0.1 for $0.1)")
  .setAction(async (taskArgs, hre) => {
    hre.changeNetwork(taskArgs.chain);

    const ethers = hre.ethers;
    let cfg = await loadConfig(hre, taskArgs.chain);
    const decimals = await cfg.token.decimals(); //TODO(PERF)
    const amt = hre.ethers.utils.parseUnits(taskArgs.amount, decimals);

    let tx = await cfg.token?.connect(cfg.owner).increaseAllowance(cfg.bridge.address, amt);
    console.log(`increase allownce by ${amt.toString()} tx(${tx.hash})`)
    await tx.wait();

    tx = await cfg.bridge.connect(cfg.owner).supply(amt);
    console.log(`supply bridge amt(${amt.toString()}) tx(${tx.hash})`)
    await tx.wait();
  });

task("dumpdb", "dumpdb")
  .setAction(async (taskArgs, hre) => {
    //await addRecord("0xaa", "from", "to", "from_a", "to_a", 0.1);
    console.log(await dumpRecords());
  });

task("launchRelay", "Launc relay")
  .addParam("chain1", "chain1")
  .addParam("chain2", "chain2")
  .addParam("relay1", "relay account for chain1")
  .addParam("relay2", "relay account for chain2")
  .setAction(async (taskArgs, hre) => {
    let cfg1 = await loadConfig(hre, taskArgs.chain1);
    let cfg2 = await loadConfig(hre, taskArgs.chain2);

    const dec1 = await cfg1.token.decimals();
    const dec2 = await cfg2.token.decimals();
    //console.log("dec1=", dec1, "dec2=", dec2);

    const cfg: RelayConfig = {
      chain1: taskArgs.chain1,
      chain2: taskArgs.chain2,
      relayOwner1: cfg1[taskArgs.relay1 as keyof ChainConfig],
      relayOwner2: cfg2[taskArgs.relay2 as keyof ChainConfig],
      bridge1: cfg1.bridge,
      bridge2: cfg2.bridge,
      decimals1: dec1,
      decimals2: dec2,
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

task("approve", "increase allownce for user to bridge")
  .addParam("chain", "from chain name")
  .addParam("account", "nickname(alice|bob)")
  .setAction(async (taskArgs, hre) => {
    hre.changeNetwork(taskArgs.chain);
    const cfg = await loadConfig(hre, taskArgs.chain);
    const account: keyof ChainConfig = taskArgs.account;
    const tx = await cfg.token?.connect(cfg[account]).approve(cfg.bridge.address, hre.ethers.constants.MaxUint256);
    console.log(`approve ${account} txhash(${tx.hash})`)
    await tx.wait();
  })


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

    const decimals = await cfg1.token.decimals(); //TODO(PERF)
    const amt = hre.ethers.utils.parseUnits(taskArgs.amount, decimals);

    const toAddress = getAddress(cfg2, taskArgs.to);
    const from: keyof ChainConfig = taskArgs.from;

    let tx = await cfg1.token?.connect(cfg1[from]).approve(cfg1.bridge.address, hre.ethers.constants.MaxUint256);
    console.log(`approve ${from} txhash(${tx.hash})`)

    tx = await cfg1.bridge.connect(cfg1[from]).lock(
      100, //HACK: not really checked anywhere // TODO: proper
      toAddress,
      cfg1.token?.address,
      cfg2.token?.address,
      amt);
    console.log(`[LOCK] from_chain(${taskArgs.fromchain}) from(${taskArgs.from}) to_chain(${taskArgs.tochain}) to(${taskArgs.to}) amt(${amt}) tx(${tx.hash})`)
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
