npx hardhat deployTestToken --chain chain1 --name Token --symbol TOK --decimals 18
npx hardhat deployBridge --chain chain1
npx hardhat deployTestToken --chain chain2 --name Token --symbol TOK --decimals 6
npx hardhat deployBridge --chain chain2

npx hardhat sendToken --chain chain1 --from owner --to bob --amount 1000
npx hardhat sendToken --chain chain1 --from owner --to alice --amount 1000
npx hardhat sendToken --chain chain2 --from owner --to bob --amount 1000
npx hardhat sendToken --chain chain2 --from owner --to alice --amount 1000
