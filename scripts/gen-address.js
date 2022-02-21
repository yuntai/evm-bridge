const ethWallet = require('ethereumjs-wallet');

pvks = []

for(let index=0; index<8; index++) {
  let addressData = ethWallet.default.generate();
  pvks.push(addressData.getPrivateKeyString());
  //pubks.push(addressData.getAddressString());
}

x=`ACCOUNTS1=${JSON.stringify(pvks.slice(0,4))}
ACCOUNTS2=${JSON.stringify(pvks.slice(4))}`
console.log(x);

