const hre = require("hardhat");

async function main() {
  hre.changeNetwork("mumbai");
  await stat('mumbai');
  hre.changeNetwork("rinkeby");
  await stat('binance_test');
}

async function stat(chain) {
  console.log(`----- ${chain} ----`);
  let dist_amount;
  [owner, relay, bob, alice, ..._] = await ethers.getSigners();

  let blockNumber = await ethers.provider.getBlockNumber()
  console.log('blockNumber: ' + blockNumber);

  for(let n of [owner, relay, bob, alice]) {
    let balance = await ethers.provider.getBalance(n.address);
    console.log("address=", n.address);
    console.log("balance=", balance);

    if(n == owner && chain=='rinkeby') {
      console.log("here!!!!!");
      console.log(balance.div(4));
      dist_amount = balance.div(4);
    }
  }

  if(chain=='rinkeby' && 1) {
    for(let to of [relay, bob, alice])  {
      console.log("sending ${dist_amount} to ${to.address}");
      //await owner.sendTransaction({
      //  to: to.address,
      //  value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
      //});
    }
  }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
