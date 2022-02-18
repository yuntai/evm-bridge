const hre = require("hardhat");

async function save_config(cfgs) {
  const data = JSON.stringify(cfgs);
  try {
    fs.writeFileSync('cfg.json', JSON.stringify(cfgs));
    console.log("JSON data is saved.");
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  let cfgs = [];
  hre.changeNetwork("mumbai");
  cfgs.append(await deploy("mumbai"));
  hre.changeNetwork("rinkeby");
  cfgs.append(await deploy("rinkeby"));
  await save_config(cfgs);
}

/*
 * deploying Token to mumbai.
 * token.address= 0x1db617f615c33Bd00A196Fc303f10C8A5a7202C6
 * deploying Bridge to mumbai.
 * bridge.address= 0x45acA37e0047cE7162Fc5860F815D9C9D8FC9b09
 * deploying Token to rinkeby.
 * token.address= 0x55903596FA617289445153B9ce76b7753F98bA30
 * deploying Bridge to rinkeby.
 * bridge.address= 0x7584F318c01aa1484861C2170896c8B070eE11f0
 */



async function deploy(chain) {
  [owner, relayOwner, ..._] = await ethers.getSigners();

  console.log(`deploying Token to ${chain}.`);
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.connect(owner).deploy();
  await token.deployed();
  console.log("token.address=", token.address);

  console.log(`deploying Bridge to ${chain}.`);
  const Bridge = await ethers.getContractFactory("Bridge");
  const bridge = await Bridge.connect(owner).deploy(relayOwner.address, token.address);
  await token.deployed();
  console.log("bridge.address=", bridge.address);

  return {
    name: chain,
    token_address: token.address,
    bridge_address: bridge.address
  }
}

async function check_deployment(cfg) {
  [owner, relayOwner, ..._] = await ethers.getSigners();
  cfg.token = await ethers.Token.at(cfg.token_address);
  cfg.bridge = await ethers.Bridge.at(cfg.bridge_address);
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
