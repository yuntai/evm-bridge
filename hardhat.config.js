require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("hardhat-change-network");

// genearted with
//const ethWallet = require('ethereumjs-wallet');
//for(let index=0; index < 6; index++) {
//      let addressData = ethWallet.default.generate();
//      console.log(`Private key = , ${addressData.getPrivateKeyString()}`);
//      console.log(`Address = , ${addressData.getAddressString()}`);
//}

ACCOUNTS1=[
"0x3e797c2a2ea9c126c27118b577899d1bc220544433b6a90b7cb29ee0bd4d817d",
"0x72505b4b4d0f2d2fa0dcd7b2e0fd6cbbc158a9ec791b27ff195fca559e416269",
"0x819aa38f9366dad2abf2af20e71823d236ab011baa7f23ebc3ee347aeaeb2703",
"0x993baaff506d86e56a470e3c6b1e3cf685645384ad6bcdf5c11462b6b9807d21",
];

// pub address
//0xA70644fB5Da66181378514575616E11D9ea295d3
//0xe704739672ED4338c15d1FFF5CA11529660C669c
//0x82EB9ABCEa5cCbd2909CaAEB7A2e0C871fdB8734
//0x2D4eB44D4E8bee0ec29b061697BeD830bDeA958c


ACCOUNTS2=[
"0xf38be8dda7d5e4fd9c19749df7352165a94195952da0052d9fbbb6bb6fe7c81a",
"0x08d803e75d82786fb2557c0bdaac07e457c182faa61507a9b4f42a8a0d2508bf"
];

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
// TODO: check chainId is correctly set in testnet
module.exports = {
  solidity: "0.8.4",
  networks: {
    chain1: {
      url: "http://localhost:18545",
    },
    chain2: {
      url: "http://localhost:28545",
    },
    //chain1: {
    //  url: "http://localhost:18545",
    //  //chainId: 654321,
    //  accounts: ACCOUNTS1,
    //},
    //chain2: {
    //  url: "http://localhost:28545"
    //  //chainId: 654322,
    //  accounts: ACCOUNTS2,
    //}
  }
};
