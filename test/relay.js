class Relayer {
  constructor(pk, bridges) {
    this.pk = pk;

    // should be based on chain id
    this.bridges = bridges;

    this.router = {
      'chain1': 'chain2',
      'chain2': 'chain1',
    }

    this.events = {
      'chain1': [],
      'chain2': [],
    }

    const events = ['LockEvent', 'RevertRequestEvent', 'RevertResponseEvent'];
    for(let evt of events) {
      for(let chain in bridges) {
        this.bridges[chain].on(evt, (args) => {
          this.events[chain].push({name: evt, args: args, from: chain});
        });
      }
    }
  }

  async get_record(chain_name, _id) {
    hre.changeNetwork(chain_name);
    const _rec = await this.bridges[chain_name].connect(this.pk).records(_id);
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

  async flush_events(chain) {
    // web3.js event is based on polling so we need to sleep here
    await new Promise(res => setTimeout(() => res(null), 300));
    for(let evt of this.events[chain]) {
      await this.handle(evt);
    }
    this.events[chain] = [];
  }

  async handle(evt) {
    const _id = evt.args;
    const target_chain = this.router[evt.from];
    const target = this.bridges[target_chain];
    let rec;

    switch (evt.name) {
      case 'LockEvent':
        rec = await this.get_record(evt.from, _id);
        hre.changeNetwork(target_chain);
        await target.connect(this.pk).handle_lock(rec);
        break;

      case 'RevertRequestEvent':
        hre.changeNetwork(target_chain);
        await target.connect(this.pk).handle_revert_request(_id);
        break;

      case 'RevertResponseEvent':
        rec = await this.get_record(evt.from, _id);
        hre.changeNetwork(target_chain);
        await target.connect(this.pk).handle_revert_response(_id, rec.state);
        break;

      default:
        console.log(`enknown event ${evt.name}.`);
        //TOOD: assert(0)
      }
  }
}

module.exports.Relayer = Relayer;
