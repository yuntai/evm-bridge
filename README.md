# evm-bridge

## Installation
```
npm install
```

## Test on main nets with USDC (betwen polygon and bsc)
In `hardhat.config.ts`, main nets are configured with four test accounts, nicknamed `owner`, `relayOwner`, `bob` and `alice`. The preconfigured private keys for these four accounts are read from `.env` file.
`owner` account is one who bridge contract and `relayOwner` is the account invoking the contract from the relayer.
In `cfgs` directory, the addresses of already deoployed contracts are stored.

To see the current status of deoployment,

`npx hardhat stat --chain polygon`, or

`npx hardhat stat --chain bsc`

To run the relayer between `polygon` and `bsc` chains,

In a new shell,

`npx hardhat launchRelay --chain1 polygon --chain2 bsc`,

where you can see logs of the events and which handlers are being invoked.

Note that, with the current implmentation, the relayer should be running for the correct delivery of the events to the other chain. Any missing events for whatever reason are not automatically recovered.

### lock & release
For `lock` operatoin,

`npx hardhat lock --fromchain polygon --tochain bsc --from alice --to bob --amount 0.1`

where `--amount` is denominated in unit. That is, 0.1 mean 10 cents.

when successful, you can get the id of the bridge record. You can plug that in the following command to release the fund from the `bsc` chain.

`npx hardhat release --chain bsc --account bob --id {id}`

### lock & revert succesful
`npx hardhat lock --fromchain bsc --tochain polygon --from alice --to bob --amount 0.5`

`npx hardhat revert --account alice --chain bsc --id {id}`

`npx hardhat redeem --account alice --chain bsc --id {id}`

The follwoing attempt to release the locked fund from `polygon` chain should fail after the above `revert` operation.

`npx hardhat release --account bob --chain polygon --id {id}`

Currently, the revert reason is not retrieved but you can check it from [BSC Testnet explorer](https://testnet.bscscan.com/).
The revert reason should show `bridge: invalid state`.

### lock & revert failure
`npx hardhat lock --fromchain bsc --tochain polygon --from alice --to bob --amount 0.5`

This time `bob` on `polygon` release the fund first.

`npx hardhat release --account bob --chain polygon --id {id}`

When `alice` try to revert the bridge transaction with

`npx hardhat revert --account alice --chain bsc --id {id}`

 and try to redeem the fund with

`npx hardhat redeem --account alice --chain bsc --id {id}`

It should fail.

Before issuing `redeem` command, the status of the bridge record can be checked using

`npx hardhat txStatus --chain mumbai --id {id}`

which should show `RELEASED` state.

## Test
To run local test, two local hardhat nodes need to run,
```
npx hardnat node --port 18545
npx hardnat node --port 28545
npx hardhat test
```

# Others

### generate remote accounts
`npx hardhat scripts/gen-address.ts > .env`

### deploy token
`npx hardhat deployToken --chain mumbai`
`npx hardhat deployToken --chain binance_test`

### deploy bridge
`npx hardhat deployBridge --chain mumbai`
`npx hardhat deployBridge --chain binance_test`

### send token
`npx hardhat sendToken --chain mumbai --to bob --amount 10000`
`npx hardhat sendToken --chain mumbai --to alice --amount 10000`

### send ether
`npx hardhat sendEther --chain binance_test --to relayOwner --amount 232678286250000000`
`npx hardhat sendEther --chain binance_test --to bob --amount 232678286250000000`
`npx hardhat sendEther --chain binance_test --to alice --amount 232678286250000000`

### supply bridge
`npx hardhat supplyBridge --chain mumbai --amount 1000`
`npx hardhat supplyBridge --chain binance_test --amount 1000`

### launch relayer
`npx hardhat launchRelay --chain1 mumbai --chain2 binance_test`

### lock operation
`npx hardhat lock --fromchain rinkeby --tochain mumbai --from alice --to bob --amount 5`

### release operation
`npx hardhat release --chain mumbai --account bob --id 0x36b3ffd146d0035525d0c674c62351c0f3798938c45aeca758657cc07a9e5e63`

### checking transaction status
`npx hardhat txstatus --chain mumbai --account bob --id 0x36b3ffd146d0035525d0c674c62351c0f3798938c45aeca758657cc07a9e5e63`

### Testnet Faucets
- polygon faucet `https://faucet.polygon.technology/`
- binance faucet `https://testnet.binance.org/faucet-smart`
- rinkeby faucet `https://faucet.rinkeby.io/`

## build test configuration from scratch
## Known issues & TODO
- make relay stateful (events catchup logic?)
  firebase w/ rpc may be a good architecture if we don't care too much about perf/.
- peer balance logic is fragile. additional sync command necessary?
- proper to have handling decimals in relay?
  should it be inside contract?
- gas limit and price hardcoded
- duplicate rpc requests in the scripts (minor)
- withdrawal/kill from bridge
- bridge admin (lifecycle, change relayer, owner, token etc)

## Other notes
- polygon default rpc stucky. alchemy is used.
