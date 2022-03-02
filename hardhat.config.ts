import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "hardhat-change-network";

import "dotenv/config"

import "./tasks/sampleTask";

// mainnet accounts
const ACCOUNTS1: string[] = JSON.parse(process.env.ACCOUNTS1!);
const POLYGON_ACCOUNTS: string[] = JSON.parse(process.env.POLYGON_ACCOUNTS!);
const ALCHEMY_KEY_POLYGON: string = process.env.ALCHEMY_KEY_POLYGON!;

const TEST_ACCOUNTS1 = [
  '0x6dbbd3c1b1338cedd7073dd231fbce0390be21fb0127721a12a9ded2853a3524',
  '0x2498db3f20d96106c0731252b6c6c5721ba11f6b200b35e3086fa5a8ecd51d14',
  '0x5b1ee13fe372c253a971adac355d05e58238eaa3821f71813aa2e4cddbd7f0e2',
  '0x4554ca947596c4395336f34b9eee2599c5ab148baec54321abcdd6c8340991aa',
  '0x1701a6d378fe1bbfd0270abe6164151d4f10f94dcbca884d19d6c34ec18fcc65',
  '0xf4cc73a312d52f4f473091f1a53761b0fd4d68138f4869acf4a02b1c1470fbdf',
  '0xf324b4bce67919456b367c3ad22262f15612db7490b9ebec608cbf5655dfa9d1',
  '0x6b1fc615f3a88539ec58220cea952cc4c477fd4eb2b3c9f36abca98937608be4'
]

const TEST_ACCOUNTS2 = [
  '0xbc7ea2cdc28a4e4f5256e6e612c2802d06990aaac825d9f3409bc98f683e124a',
  '0x94b3a106a3e37463ccfe38e6bfab19e93fa3f75426dcf13b09281391ce37ac47',
  '0xd8f0d7e9b2af656c07a82af9734b69fe1af3d67bd7f5325a9fd6c5684ffaa97f',
  '0x46f55187eed2f994ebfce9b798204a350e95edd71782333e25db157e340e43f8',
  '0x512b40ce79e6c57dc3c589a8110116f91edf34c990de013e927ff40a5f7df219',
  '0xbb7557bf1c85307b1863b79156f0630ccb4f13fc49ef0735ef57532ec12431a3',
  '0x442481aaf099d31c11e830a25e8108c0dcff152b48386136e20daa08bb840723',
  '0xe2886f9beee3188ccdcfcb89c43c1857c9e33bf8c51ac5d811c84d6fb305483b'
]

const TEST_ACCOUNTS3 = [
  "0xc427a4098557f29f0f2e028062ff0f4fea08ce191378b7141526cbb21d9385fc",
  "0x70fc6a0df1e93c25b3134ccf6db9e4c8454cab5c273d9e6840178537206ef7dc",
  "0x083a2c1d843c662c6b09f366f6a7a0a702ceb72686c3a7fe041635580a6adb62",
  "0x9246971993ce99a918440d98e391d43b9a4ba6eb77829388fa37cc938774bea8",
  "0x012ed3bb988f69db7c97e6a64ad51fdb713fa5c828758123ee959c10279c34b3",
  "0x65fd665610169a0e1239df2ffab25cb5699873c3c69b079ddcb37174cd343dcc",
  "0x9a0b3c9cabf69509e664bb03deefb2125b0d774887b8d5d6efad19c9020741c2",
  "0x96a9ba0974a9dfeec44f75edd0e15d78a5addab28d007f70611c3cb3c71ddc4d"
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
      gasLimit: 2100000, // 2.1 mil (cover depoly Bridge)
      gasPrice: 8000000000, // 8 Gwei
      accounts: TEST_ACCOUNTS1,
    },
    bsc_test: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasLimit: 2100000,
      gasPrice: 11000000000, // 11 Gwei
      accounts: TEST_ACCOUNTS2,
    },
    rinkeby: {
      chainId: 4,
      url: "https://eth-rinkeby.alchemyapi.io/v2/fvk3umZQZCAvNpeKKQdVlnCC4wjooFGa",
      gasLimit: 2100000,
      gasPrice: 8000000000, // 8 Gwei
      accounts: TEST_ACCOUNTS3,
    },
    bsc: {
      url: "https://bscnode1.anyswap.exchange",
      chainId: 56,
      gasLimit: 210000,
      gasPrice: 6000000000, // 6 Gwei
      accounts: ACCOUNTS1,
      // minmim required (2.1e6 * 6e9/1e18 = 0.0126 bsc)
    },
    polygon: {
      chainId: 137,
      url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY_POLYGON}`,
      gasLimit: 210000,
      gasPrice: 50000000000, // 50 Gwei
      accounts: POLYGON_ACCOUNTS,
      // gas for install bridge: 2,856,559
      // minmim required (2.1e6 * 50e9/1e18 = 0.105 matic)
    }
  }
};
