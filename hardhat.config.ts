import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "hardhat-change-network";
import "./tasks/sampleTask";
import "dotenv/config"

// mainnet accounts
const ACCOUNTS1: string[] = JSON.parse(process.env.ACCOUNTS1!);
const ACCOUNTS2: string[] = JSON.parse(process.env.ACCOUNTS2!);

const TEST_ACCOUNTS1 = [
  '0x6dbbd3c1b1338cedd7073dd231fbce0390be21fb0127721a12a9ded2853a3524',
  '0x2498db3f20d96106c0731252b6c6c5721ba11f6b200b35e3086fa5a8ecd51d14',
  '0x5b1ee13fe372c253a971adac355d05e58238eaa3821f71813aa2e4cddbd7f0e2',
  '0x4554ca947596c4395336f34b9eee2599c5ab148baec54321abcdd6c8340991aa',
]

const TEST_ACCOUNTS2 = [
  '0xbc7ea2cdc28a4e4f5256e6e612c2802d06990aaac825d9f3409bc98f683e124a',
  '0x94b3a106a3e37463ccfe38e6bfab19e93fa3f75426dcf13b09281391ce37ac47',
  '0xd8f0d7e9b2af656c07a82af9734b69fe1af3d67bd7f5325a9fd6c5684ffaa97f',
  '0x46f55187eed2f994ebfce9b798204a350e95edd71782333e25db157e340e43f8'
]

const TEST_ACCOUNTS3 = [
  "0xc427a4098557f29f0f2e028062ff0f4fea08ce191378b7141526cbb21d9385fc",
  "0x70fc6a0df1e93c25b3134ccf6db9e4c8454cab5c273d9e6840178537206ef7dc",
  "0x083a2c1d843c662c6b09f366f6a7a0a702ceb72686c3a7fe041635580a6adb62",
  "0x9246971993ce99a918440d98e391d43b9a4ba6eb77829388fa37cc938774bea8"
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
    // chain1 & chain2 are hardhat nodes
    chain1: {
      url: "http://localhost:18545",
    },
    chain2: {
      url: "http://localhost:28545",
    },
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com',
      chainId: 80001,
      gas: 2100000, // 2.1 mil (cover depoly Bridge)
      gasPrice: 8000000000, // 8 Gwei
      accounts: TEST_ACCOUNTS1,
    },
    binance_test: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gas: 2100000,
      gasPrice: 11000000000, // 11 Gwei
      accounts: TEST_ACCOUNTS2,
    },
    rinkeby: {
      chainId: 4,
      url: "https://eth-rinkeby.alchemyapi.io/v2/fvk3umZQZCAvNpeKKQdVlnCC4wjooFGa",
      gas: 2100000,
      gasPrice: 8000000000, // 8 Gwei
      accounts: TEST_ACCOUNTS3,
    },
    bsc: {
      url: "https://bscnode1.anyswap.exchange",
      chainId: 56,
      gas: 210000,
      gasPrice: 6000000000, // 6 Gwei
      accounts: ACCOUNTS1,
      // minmim required (2.1e6 * 6e9/1e18 = 0.0126 bsc)
    },
    polygon: {
      chainId: 137,
      url: "https://polygon-rpc.com",
      gas: 210000,
      gasPrice: 30000000000, // 30 Gwei
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
