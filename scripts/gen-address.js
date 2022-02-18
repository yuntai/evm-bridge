// genearted with
const ethWallet = require('ethereumjs-wallet');

pvks = []
pubks = []

for(let index=0; index < 6; index++) {
  let addressData = ethWallet.generate();
  pvks.push(addressData.getPrivateKeyString());
  pubks.push(addressData.getAddressString());
}

console.log(pvks);
console.log(pubks);
