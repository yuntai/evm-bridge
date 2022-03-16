import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, Signer, BigNumber } from "ethers";
import { ethers, config as hreConfig } from "hardhat";
import { Relayer, RelayConfig } from "../tasks/relay";
import { TransferState } from "../tasks/common";
import hre from 'hardhat';
import BridgeABI from "../artifacts/contracts/bridge.sol/Bridge.json"

describe("Deployer test", function () {
  it("deployer", async function () {
    //hardhat problem with create2
    hre.changeNetwork('chain1');
    const salt = 112312;
    const abiCoder = ethers.utils.defaultAbiCoder;
    let [owner, bob, alice, relay, relay2, relay3, ..._] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("Token", "TOK", 18);
    await token.deployed();

    const Deployer = await ethers.getContractFactory("AnyswapCreate2Deployer");
    const deployer = await Deployer.deploy();

    const contractCode = (await ethers.getContractFactory('Bridge')).bytecode
    const params = abiCoder.encode(['address', 'address'], [relay.address, token.address]).slice(2);
    const byteCode = `${contractCode}${params}`;

    const tx = await deployer.deploy(byteCode, salt);
    const saltHex = ethers.utils.hexZeroPad(ethers.utils.hexValue(salt), 32);
    const expectedAddress = ethers.utils.getCreate2Address(
	deployer.address, 
	saltHex, 
	ethers.utils.keccak256(byteCode));
    await expect(tx).to.emit(deployer, 'Deployed').withArgs(expectedAddress, salt);
  });
});
