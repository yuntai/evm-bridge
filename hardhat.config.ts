import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "hardhat-change-network";

// genearted with `node scripts/gen-address.js`
// polygon faucet `https://faucet.polygon.technology/`
const ACCOUNTS1 = [
  '0x6dbbd3c1b1338cedd7073dd231fbce0390be21fb0127721a12a9ded2853a3524',
  '0x2498db3f20d96106c0731252b6c6c5721ba11f6b200b35e3086fa5a8ecd51d14',
  '0x5b1ee13fe372c253a971adac355d05e58238eaa3821f71813aa2e4cddbd7f0e2',
  '0x4554ca947596c4395336f34b9eee2599c5ab148baec54321abcdd6c8340991aa',
  '0x26c7b4b631b84549b1236b722b697a3f5a0e486e6010e9442d99b0e1550eb039',
  '0xc78c1e7f77cd3a7f464aa940b9870aa048ea5443795c9efa7da19cb9ce14a02f',
  '0x779a8f7cc70be9b445e0d8e1cc1ebbe1c74de2693c9f86b8b9b4701b4510bce2'
]
const PUBKEYS1 = [
  '0x0106772a7698c070Ee06C66Db06BF24edb5123a8',
  '0x9924ebd64385ae2fc7579063bd63a4a479698d21',
  '0x27ed321666fc7ba8fe00301170607c91b511847a',
  '0x45109b819f0c654ae89bf241fa360afcdf95aa79',
  '0xa7106d415da188c12163575f72abb96af6c2f31e',
  '0xaedca1c29539c367f9f32fcb50f5b40c78adfd72',
  '0x264bbb1d63c4d6785e2e86ed827e19bf00875854'
]

// binance faucet 'https://testnet.binance.org/faucet-smart'
const ACCOUNTS2 = [
  '0xbc7ea2cdc28a4e4f5256e6e612c2802d06990aaac825d9f3409bc98f683e124a',
  '0x94b3a106a3e37463ccfe38e6bfab19e93fa3f75426dcf13b09281391ce37ac47',
  '0xd8f0d7e9b2af656c07a82af9734b69fe1af3d67bd7f5325a9fd6c5684ffaa97f',
  '0x46f55187eed2f994ebfce9b798204a350e95edd71782333e25db157e340e43f8',
  '0x503e4a5074931412afc2d9b9b0a39f65d5e7ca3e7651028d7743416c2f787a41',
  '0x4fd53f2c19c33d5cfc1e63e3251346c95a073ab22f8afa63b1b9c5e6004e5dc1',
  '0x333eb48308222058746d10ac27d87ff2d1d1755bd435b6d94608a9dcc927bd89'
]
const PUBKES2 = [
  '0x4C883eFB395fB7Ea3757f0279f29FF635cB68ef6',
  '0xae9f252a4e5fec118a49ccfb992137f747dc4818',
  '0xb3eb3c3695b8e794c5ddc93ef782d6d8fc4fd937',
  '0x3c8cd9c0d37c3a6a4dcf3df4cf8addd199aa5dfd',
  '0xf2f7dcdb66aded6da686b8b48a9f81ca993d120d',
  '0x17a1f30d5288b9708ed8cd3e214dcb60269a8dc0',
  '0x2bdf1cf8d10619f7fb8eeb499eff8b33a8483d56'
]

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
export default {
  solidity: "0.8.4",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    chain1: {
      url: "http://localhost:18545",
    },
    chain2: {
      url: "http://localhost:28545",
    },
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com',
      chainId: 80001,
      accounts: ACCOUNTS1,
    },
    binance_test: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: ACCOUNTS2,
    },
    rinkeby: {
      url: "https://eth-rinkeby.alchemyapi.io/v2/fvk3umZQZCAvNpeKKQdVlnCC4wjooFGa",
      accounts: ACCOUNTS2,
    },


    //local1: {
    //  url: "http://localhost:18545",
    //  //chainId: 654321,
    //  accounts: ACCOUNTS1,
    //},
    //local2: {
    //  url: "http://localhost:28545"
    //  //chainId: 654322,
    //  accounts: ACCOUNTS2,
    //}
  }
};
