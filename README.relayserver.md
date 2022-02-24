0. grab a linux box

   open port 3000

1. clone repo

   `git clone https://github.com/steven4354/evm-bridge.git`

2. install nodejs
```
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```
3. install sqlite

   `sudo apt install sqlite3`

4. in the repo root directory, install packages

   `npm install`

5. make `.env` file in the repo root directory

6. create a db, in the repo root directory

   `bash scripts/initdb.sh`

    which whill create `db.db` file

7. launch rest server

   `nohup npx ts-node app.ts > express.log &`

8. launch relay

   `nohup npx hardhat launchRelay --chain1 bsc --chain2 polygon  > relay.log &`

9. check db records

   `sqlite3 db.db "select * from records"`

    or using `http://xxx.xxx.xxx.xxx:3000/records`
