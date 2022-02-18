import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import hre from 'hardhat';

export enum TransferState {
  LOCKED,
  REVERT_REQUESTED,
  REVERTED,
  REDEEMED,
  RELEASED
}

interface Event {
  from: string,
  name: string,
  args: any,
  to: string,
  target: Contract
}

export class Relayer {
  owner: SignerWithAddress;
  bridges: { [chain: string]: Contract }
  events: { [chain: string]: Event[] } = { chain1: [], chain2: [] };

  constructor(owner: SignerWithAddress, bridges: { [chain: string]: Contract }) {
    this.owner = owner;
    this.bridges = bridges;
    // should be based on chainId but hardhat doesn't allow to configure chainId
    let routers: { [chain: string]: string } = { 'chain1': 'chain2', 'chain2': 'chain1' };

    for (let evt of ['LockEvent', 'RevertRequestEvent', 'RevertResponseEvent', 'SupplyEvent']) {
      for (let b in this.bridges) {
        this.bridges[b].on(evt, (args: any) => {
	  const target = this.bridges[routers[b]];
          this.events[b].push({ name: evt, args: args, from: b, to: routers[b], target: target });
        });
      }
    }
  }

  async get_record(chain: string, _id: string) {
    hre.changeNetwork(chain);
    const _rec = await this.bridges[chain].connect(this.owner).records(_id);
    let rec = {
      id: _rec.id,
      from_chain_id: _rec.from_chain_id,
      to_chain_id: _rec.to_chain_id,
      from_address: _rec.from_address,
      to_address: _rec.to_address,
      from_token: _rec.from_token,
      to_token: _rec.to_token,
      amount: _rec.amount,
      state: _rec.state,
    }
    return rec;
  }

  async flush_events(chain: string) {
    // web3.js event is based on polling so we need to sleep here
    await new Promise(res => setTimeout(() => res(null), 300));

    for (let evt of this.events[chain]) {
      await this.handle(evt);
    }
    this.events[chain] = [];
  }

  async handle(evt: Event) {
    let rec;

    switch (evt.name) {
      case 'LockEvent':
        rec = await this.get_record(evt.from, evt.args);
        hre.changeNetwork(evt.to);
        await evt.target.connect(this.owner).handle_lock(rec);
        break;

      case 'RevertRequestEvent':
        hre.changeNetwork(evt.to);
        await evt.target.connect(this.owner).handle_revert_request(evt.args);
        break;

      case 'RevertResponseEvent':
        rec = await this.get_record(evt.from, evt.args);
        hre.changeNetwork(evt.to);
        await evt.target.connect(this.owner).handle_revert_response(evt.args, rec.state);
        break;

      case 'SupplyEvent':
        hre.changeNetwork(evt.to);
        await evt.target.connect(this.owner).handle_supply(evt.args);
        break;

      default:
	throw new Error(`unknown event ${evt.name}.`);
    }
  }
}

export default Relayer;
