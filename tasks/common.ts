import fs from "fs";
import path from 'path';
import { printTable } from 'console-table-printer';
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export interface ChainConfig {
  token: Contract | undefined,
  bridge: Contract | undefined,
  owner: SignerWithAddress,
  relayOwner: SignerWithAddress,
  bob: SignerWithAddress,
  alice: SignerWithAddress,
}

export async function printConfig(cfg: ChainConfig, hre: any) {
  let getBalance = ((address: string | undefined) => hre.ethers.provider.getBalance(address));
  let getTokenBalance = ((address: string | undefined) => cfg.token?.balanceOf(address));

  const decimals = await cfg.token?.decimals();

  const tbls = [];
  let k: keyof ChainConfig;
  for (k in cfg) {
    //TODO batch?
    if (cfg[k]) {
      const bal = await getBalance(cfg[k]?.address);
      const tokenBal = await getTokenBalance(cfg[k]?.address);
      tbls.push({
        account: k,
        address: cfg[k]?.address,
        value: bal.toString() + ' (' + hre.ethers.utils.formatEther(bal) + ')',
        token: tokenBal ? tokenBal.toString() + ' (' + hre.ethers.utils.formatUnits(tokenBal?.toString(), decimals) + ')' : '',
      });
    }
  }
  printTable(tbls);
}

export function saveConfig(cfg: ChainConfig, chain: string) {
  const p = path.resolve(__dirname, `../cfgs/${chain}.json`);
  const o = {
    token_address: cfg.token?.address,
    bridge_address: cfg.bridge?.address,
  };

  try {
    fs.writeFileSync(p, JSON.stringify(o));
  } catch (err) {
    console.error(err);
  }
}

export async function loadConfig(hre: any, chain: string) {
  hre.changeNetwork(chain);
  const p = path.resolve(__dirname, `../cfgs/${chain}.json`);
  let data = '';
  if (fs.existsSync(p)) {
    data = fs.readFileSync(p, { encoding: 'utf8', flag: 'r' });
  }
  let token, bridge;

  if (data.length > 0) {
    const cfg = JSON.parse(data)
    if (cfg.token_address) {
      token = await hre.ethers.getContractAt("ERC20", cfg.token_address);
    }
    if (cfg.bridge_address)
      bridge = await hre.ethers.getContractAt("Bridge", cfg.bridge_address);
  }

  const [owner, relay, bob, alice, ..._] = await hre.ethers.getSigners();

  return {
    token: token,
    bridge: bridge,
    owner: owner,
    relayOwner: relay,
    bob: bob,
    alice: alice,
  }
}

export enum TransferState {
  LOCKED,
  REVERT_REQUESTED,
  REVERTED,
  REDEEMED,
  RELEASED
}

export function getStateName(state: TransferState) {
  const transferStateMap = {
    [TransferState.LOCKED]: 'LOCKED',
    [TransferState.REVERT_REQUESTED]: 'REVERT_REQUESTED',
    [TransferState.REVERTED]: 'REVERTED',
    [TransferState.REDEEMED]: 'REDEEMED',
    [TransferState.RELEASED]: 'RELEASED'
  }
  return transferStateMap[state];
}
