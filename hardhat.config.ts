import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "hardhat-change-network";
import "./tasks/sampleTask";
import "dotenv/config"

const ACCOUNTS1: string[] = JSON.parse(process.env.ACCOUNTS1!);
const ACCOUNTS2: string[] = JSON.parse(process.env.ACCOUNTS2!);

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
      gas: 2100000, // 2.1 mil (cover depoly Bridge)
      gasPrice: 8000000000 // 8 Gwei
    },
    binance_test: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gas: 2100000,
      gasPrice: 10000000000,
      accounts: ACCOUNTS2,
    },
    rinkeby: {
      chainId: 4,
      url: "https://eth-rinkeby.alchemyapi.io/v2/fvk3umZQZCAvNpeKKQdVlnCC4wjooFGa",
      accounts: ACCOUNTS2,
      gas: 2100000,
      gasPrice: 8000000000
    },
    /*
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
    */


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
