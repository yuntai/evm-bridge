const hre = require("hardhat");

async function main() {
  hre.changeNetwork("chain1");
  await initialize();
  hre.changeNetwork("chain2");
  await initialize();
}

async function initialize() {
  [owner, bob, alice, relay, ..._] = await ethers.getSigners();
  console.log(owner.address);
  console.log(bob.address);
  console.log(alice.address);
  console.log(relay.address);

  let blockNumber = await ethers.provider.getBlockNumber()
  console.log('blockNumber: ' + blockNumber);

  let balance = await ethers.provider.getBalance(owner.address);
  console.log("owner.address=", owner.address);
  console.log("owner.balance=", balance);

  const Token = await ethers.getContractFactory("Token");
  token = await Token.deploy();
  await token.deployed();
  console.log("token.address=", token.address);

  console.log("balance=", await token.balanceOf(owner.address));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
