const ethWallet = require('ethereumjs-wallet');

pvks = []
pubks = []

for(let index=0; index<8; index++) {
  let addressData = ethWallet.default.generate();
  pvks.push(addressData.getPrivateKeyString());
  pubks.push(addressData.getAddressString());
}

console.log(JSON.stringify(pvks));
console.log(JSON.stringify(pubks));

