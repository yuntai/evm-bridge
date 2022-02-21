import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { getStateName } from "./common";


export interface RelayConfig {
  chain1: string,
  chain2: string,
  relayOwner1: SignerWithAddress,
  relayOwner2: SignerWithAddress,
  bridge1: Contract,
  bridge2: Contract,
}

interface Event {
  from: string,
  name: string,
  args: any,
  to: string,
  target: Contract
}

export class Relayer {
  owners: { [chain: string]: SignerWithAddress }
  bridges: { [chain: string]: Contract }
  events: { [chain: string]: Event[] } = { chain1: [], chain2: [] };
  hre: any;

  constructor(cfg: RelayConfig, hre: any, localTestMode: boolean = false) {
    this.hre = hre;
    this.owners = {
      [cfg.chain1]: cfg.relayOwner1,
      [cfg.chain2]: cfg.relayOwner2,
    }
    this.bridges = {
      [cfg.chain1]: cfg.bridge1,
      [cfg.chain2]: cfg.bridge2,
    }

    // can be based on chainId but hardhat doesn't allow to configure chainId 
    // when using hardhat node
    let routers: { [chain: string]: string } = {
      [cfg.chain1]: cfg.chain2,
      [cfg.chain2]: cfg.chain1
    }

    console.log(`[${cfg.chain1}]`);
    console.log(`relayOwner: ${cfg.relayOwner1.address}`)
    console.log(`bridge: ${cfg.bridge1.address}`)

    console.log(`[${cfg.chain2}]`);
    console.log(`relayOwner: ${cfg.relayOwner2.address}`)
    console.log(`bridge: ${cfg.bridge2.address}`)

    const EVENTS = ['LockEvent', 'RevertRequestEvent', 'RevertResponseEvent', 'SupplyEvent', 'ReleaseEvent', 'RedeemEvent'];
    for (let evtName of EVENTS) {
      for (let b in this.bridges) {
        this.bridges[b].on(evtName, (args: any) => {
          const target = this.bridges[routers[b]];
          const event = { name: evtName, args: args, from: b, to: routers[b], target: target };
          if (localTestMode) {
            this.events[b].push(event);
          } else {
            this.handle(event);
          }
        });
      }
    }
  }

  async loop() {
    console.log("staring relay loop...")
    for (; ;) //TODO: better way?
      await new Promise(res => setTimeout(() => res(null), 300));
  }

  async get_record(chain: string, _id: string) {
    this.hre.changeNetwork(chain);
    const _rec = await this.bridges[chain].connect(this.owners[chain]).records(_id);
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
    let rec, tx, receipt;

    switch (evt.name) {
      case 'LockEvent':
        rec = await this.get_record(evt.from, evt.args);
        console.log(`${evt.name}(${evt.from}->${evt.to}) id(${rec.id}) amt(${rec.amount})`);
        this.hre.changeNetwork(evt.to);
        tx = await evt.target.connect(this.owners[evt.to]).handle_lock(rec);
        receipt = await tx.wait();
        console.log(`  handle_lock() tx(${tx.hash})`);
        if (!receipt.status) console.log('   FAILED');
        break;

      case 'RevertRequestEvent':
        console.log(`${evt.name}(${evt.from}->${evt.to}) id(${evt.args})`);
        this.hre.changeNetwork(evt.to);
        tx = await evt.target.connect(this.owners[evt.to]).handle_revert_request(evt.args);
        receipt = await tx.wait();
        console.log(`  handle_revert_request() tx(${tx.hash})`);
        if (!receipt.status) console.log('   FAILED');
        break;

      case 'RevertResponseEvent':
        rec = await this.get_record(evt.from, evt.args);
        console.log(`${evt.name} (${evt.from}->${evt.to}) id(${evt.args}) state(${getStateName(rec.state)})`);
        this.hre.changeNetwork(evt.to);
        tx = await evt.target.connect(this.owners[evt.to]).handle_revert_response(evt.args, rec.state);
        receipt = await tx.wait();
        console.log(`  handle_revert_response() tx(${tx.hash})`);
        if (!receipt.status) console.log('   FAILED');
        break;

      case 'SupplyEvent':
        this.hre.changeNetwork(evt.to);
        console.log(`${evt.name}(${evt.args}) from(${evt.from}) to(${evt.to}) amt(${evt.args})`);
        tx = await evt.target.connect(this.owners[evt.to]).handle_supply(evt.args);
        receipt = await tx.wait();
        console.log(`  handle_supply() tx(${tx.hash})`);
        if (!receipt.status) console.log('   FAILED');
        break;

      // non-routing events
      case 'ReleaseEvent':
      case 'RedeemEvent':
        //TODO: get amount
        console.log(`${evt.name}(${evt.from}) id(${evt.args})`);
        break;

      default:
        throw new Error(`unknown event ${evt.name}.`);
    }
  }
}
