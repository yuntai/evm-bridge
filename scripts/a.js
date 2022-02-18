const hre = require("hardhat");
const fs = require("fs");

const { program } = require('commander');

program.option('-c, --chain <string>');
program.parse();
const options = program.opts();
console.log(options);

//console.log(program.args[0]);
//
//const limit = options.first ? 1 : undefined;
//console.log(program.args[0].split(options.separator, limit));

async function load_config(fn) {
  const data = fs.readFileSync(fn, {encoding:'utf8', flag:'r'});
  _cfgs = JSON.parse(data);

  ret = {};
  for(let cfg of _cfgs) {
    console.log("cfg=", cfg);
    const c = await get_accounts(cfg);
    console.log(`[${c.chain}] token(${c.token.address}) bridge(${c.bridge.address})`);
    for(k of ['owner', 'relay', 'bob', 'alice']) {
      console.log(`[${c.chain}] ${k}(${c[k].address})`);
    }
    cfg[c.chain] = c;
  }
  return ret
}

async function get_accounts(cfg) {
  hre.changeNetwork(cfg.chain);
  const token = await hre.ethers.getContractAt("Token", cfg.token_address);
  const bridge = await hre.ethers.getContractAt("Bridge", cfg.bridge_address);
  [owner, relay, bob, alice, ..._] = await ethers.getSigners();
  return {
    chain: cfg.chain,
    token: token,
    bridge: bridge,
    owner: owner,
    relay: relay,
    bob: bob,
    alice: alice
  }
}

async function main() {
  let cfg = await load_config("./cfg.json");
  for(c in cfg) {
    await supply_bridge(cfg[c]);
  }
}

// supply token to bridge
async function supply_bridge(cfg) {
  hre.changeNetwork(cfg.chain);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// 1. setup
// distibute ether
// deployment
// distribute token to bob & alice and supply some tokens to bridge
// 2. run relay loop (how to make a loop?)
//    relay_loop.ts rinkeby mumbai 
// 3. invokes test script (cmd: --lock, --status, --revert, --redeem, --release)
// $ npx hardhar run ./scripts/op.ts --network rinkeby --lock [id] --bridge
//      0xaasdf

// two relayOwner addresses of course // fix test
