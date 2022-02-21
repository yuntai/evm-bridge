# evm-bridge

## Installation
```
npm install
```

## Test with Test token on test net (mumbai & binance_test)
In `hardhat.config.ts`, test nets are configured with four test accounts, nicknamed `owner`, `relayOwner`, `bob` and `alice`. 
`owner` account is one who deploys token and bridge contract and `relayOwner` is the account invoking the contract from the relayer component. 
In `cfgs` directory, the addresses of already deoployed contracts are stored.

To see the current status of deoployment,

`npx hardhat stat --chain mumbai`

To run relayer between mumbai and binance_test,

In a new shell, 

`npx hardhat launchRelay --chain1 mumbai --chain2 binance_test`,

where you can see logs of the events and what handlers are being invoked.


### lock & release
To lock,

`npx hardhat lock --fromchain mumbai --tochain binance_test --from alice --to bob --amount 50`

when successful, you can get the id of bridge record. You can plug that in the following command to release the fund from `biance_test` chain side.

`npx hardhat release --chain binance_test --account bob --id {id}`

### lock & revert succesful
`npx hardhat lock --fromchain mumbai --tochain binance_test --from alice --to bob --amount 50`

`npx hardhat revert --account alice --chain mumbai --id {id}`

`npx hardhat redeem --account alice --chain mumbai --id {id}`

The follwoing attempt to release the locked fund from `biance_test` chain should fail after the above `revert` operation.

`npx hardhat release --account bob --chain binance_test --id {id}`

Currently revert reason is not retrieved but you can check it from [BSC Testnet explorer](https://testnet.bscscan.com/).
The revert reason should show `bridge: invalid state`.

### lock & revert failure
`npx hardhat lock --fromchain mumbai --tochain binance_test --from alice --to bob --amount 50`

This time `bob` on `biance_test` release the fund first.

`npx hardhat release --account bob --chain binance_test --id {id}`

`Alice` will try to revert the bridge with

`npx hardhat revert --account alice --chain mumbai --id {id}`

and redeem, but should fail.

`npx hardhat redeem --account alice --chain mumbai --id {id}`

Before issuing `redeem` command, the status of the bridge record can be checked using
`npx hardhat txStatus --chain mumbai --id {id}`

# Test
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
