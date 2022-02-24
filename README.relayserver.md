0. grab a linux box
   open port 3000
1. clone repo
`git clone https://github.com/yuntai/evm-bridge.git`
2. `git checkout add_db`
3. install node
```
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```
4. install sqlite
`sudo apt install sqlite3`
``
``
5. in repo root, install packages
`npm install`

6. make `.env` file to repo root

7. create db, in repo root dir
`bash scripts/initdb.sh`

which whill create `db.db` file in the root directory

8. To run rest server
`nohup npx ts-node app.ts > express.log &`

9. launch relay
`nohup npx hardhat launchRelay --chain1 bsc --chain2 polygon  > relay.log &`

10. check db records
`sqlite3 db.db "select * from records"`

or using `http://xxx:3000/records`



