import fs from "fs";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export interface ChainConfig {
  token: Contract,
  bridge: Contract,
  owner: SignerWithAddress,
  relay: SignerWithAddress,
  bob: SignerWithAddress,
  alice: SignerWithAddress,
}

export async function load_config(hre: any, fn: string, chain: string) {
  hre.changeNetwork(chain);
  const data = fs.readFileSync(fn, { encoding: 'utf8', flag: 'r' });
  const cfg = JSON.parse(data)[hre.network.name];

  const token = await hre.ethers.getContractAt("Token", cfg.token_address);
  const bridge = await hre.ethers.getContractAt("Bridge", cfg.bridge_address);

  const [owner, relay, bob, alice, ..._] = await hre.ethers.getSigners();

  return {
    token: token,
    bridge: bridge,
    owner: owner,
    relay: relay,
    bob: bob,
    alice: alice,
  }
}
