import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { getStateName } from "./common";
import { addRecord, updateState } from "./db";

export interface RelayConfig {
  chain1: string,
  chain2: string,
  relayOwner1: SignerWithAddress,
  relayOwner2: SignerWithAddress,
  bridge1: Contract,
  bridge2: Contract,
  decimals1: number,
  decimals2: number,
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
  events: { [chain: string]: Event[] }
  hre: any;
  decChanger: any;

  constructor(cfg: RelayConfig, hre: any, localTestMode: boolean = false) {
    this.hre = hre;
    this.events = {[cfg.chain1]: [], [cfg.chain2]: []}
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

    //chain1: decimal=18
    //chain2: decimal=6
    // dollar amount = $3
    // chain1:  3 * 1e18
    // chain2:  3 * 1e6
    // amt from chain1: 3 * 1e18
    // dec2 - dec1 = 6 - 18 = -12
    // amt in chain2: 3 * 1e18 * 1e-12) = 3 * 1e6

    const BigNumber = hre.ethers.BigNumber;
    const ten = BigNumber.from(10);
    //TODO: fugly refactor
    this.decChanger = {
      [cfg.chain1]: (amt: any) => {
        if (cfg.decimals2 - cfg.decimals1 < 0) {
          return BigNumber.from(amt).div(ten.pow(cfg.decimals1 - cfg.decimals2))
        } else {
          return BigNumber.from(amt).mul(ten.pow(cfg.decimals2 - cfg.decimals1))
        }
      },
      [cfg.chain2]: (amt: any) => {
        if (cfg.decimals1 - cfg.decimals2 < 0) {
          return BigNumber.from(amt).div(ten.pow(cfg.decimals2 - cfg.decimals1))
        } else {
          return BigNumber.from(amt).mul(ten.pow(cfg.decimals1 - cfg.decimals2))
        }
      }
    };

    console.log(`[${cfg.chain1}]`);
    console.log(`relayOwner: ${cfg.relayOwner1.address} `)
    console.log(`bridge: ${cfg.bridge1.address} `)

    console.log(`[${cfg.chain2}]`);
    console.log(`relayOwner: ${cfg.relayOwner2.address} `)
    console.log(`bridge: ${cfg.bridge2.address} `)

    this.hre.changeNetwork(cfg.chain1);

    //TODO: read from abi
    const EVENTS = ['LockEvent', 'RevertRequestEvent', 'RevertResponseEvent', 'SupplyEvent', 'ReleaseEvent', 'RedeemEvent'];
    for (let evtName of EVENTS) {
      for (let b in this.bridges) {
        this.bridges[b].on(evtName, (...args: any[]) => {
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
        const newAmount = this.decChanger[evt.from](rec.amount);
        console.log(`${evt.name} (${evt.from} -> ${evt.to}) id(${rec.id}) amt(${rec.amount}) toAmt(${newAmount})`);
        rec.amount = newAmount;
        this.hre.changeNetwork(evt.to);
        tx = await evt.target.connect(this.owners[evt.to]).handle_lock(rec);
        receipt = await tx.wait();
        console.log(`  handle_lock() tx(${tx.hash})`);
        if (!receipt.status) console.log('   FAILED');
        try { await addRecord(rec.id, evt.from, evt.to, rec.from_address, rec.to_address, rec.amount); }
        catch (e) { console.log("DB: failed to create record", e) }
        break;

      case 'RevertRequestEvent':
        console.log(`${evt.name} (${evt.from} -> ${evt.to}) id(${evt.args})`);
        this.hre.changeNetwork(evt.to);
        tx = await evt.target.connect(this.owners[evt.to]).handle_revert_request(evt.args);
        receipt = await tx.wait();
        console.log(`  handle_revert_request() tx(${tx.hash})`);
        if (!receipt.status) console.log('   FAILED');
        break;

      case 'RevertResponseEvent':
        rec = await this.get_record(evt.from, evt.args);
        console.log(`${evt.name} (${evt.from} -> ${evt.to}) id(${evt.args}) state(${getStateName(rec.state)})`);
        this.hre.changeNetwork(evt.to);
        tx = await evt.target.connect(this.owners[evt.to]).handle_revert_response(evt.args, rec.state);
        receipt = await tx.wait();
        console.log(`  handle_revert_response() tx(${tx.hash})`);
        if (!receipt.status) console.log('   FAILED');
        break;

      case 'SupplyEvent':
        const [fromAmt, seq, ..._] = evt.args;
        const toAmt = this.decChanger[evt.from](fromAmt);
        this.hre.changeNetwork(evt.to);
        console.log(`${evt.name} from(${evt.from}) to(${evt.to}) amt(${fromAmt}) toAmt(${toAmt} seq(${seq})`);
	try {
        	tx = await evt.target.connect(this.owners[evt.to]).handle_supply(toAmt, seq);
	} catch(err) {
        // https://gist.github.com/gluk64/fdea559472d957f1138ed93bcbc6f78a
        // @ts-ignore:next-line
        console.log(err.data);
        //const code: string = err.data.replace('Reverted ','');
        //console.log({err});
        //let reason = this.hre.ethers.utils.toUtf8String('0x' + code.substr(138));
        //console.log('revert reason:', reason);
		break;
	}
        receipt = await tx.wait();
        console.log(`  handle_supply() tx(${tx.hash})`);
        if (!receipt.status) console.log('   FAILED');
        break;

      // non-routing events
      case 'ReleaseEvent':
      case 'RedeemEvent':
        //TODO: get amount
        const __s = evt.name == 'RedeemEvent' ? 'REDEEM' : 'RELEASE';
        console.log(`${evt.name} (${evt.from}) id(${evt.args})`);
        try { await updateState(evt.args, __s); }
        catch (e) { console.log("DB: failed to update state", e) }
        break;

      default:
        throw new Error(`unknown event ${evt.name}.`);
    }
  }
}
