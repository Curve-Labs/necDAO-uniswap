const ERC20 = artifacts.require('ERC20Mock');
const UniswapProxy = artifacts.require('UniswapProxy');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router = artifacts.require('UniswapV2Router02');
const WETH = artifacts.require('WETH9');

const SPECS_PATH = '../data/necDAO.json';
const DEPLOYED_PATH = './deployed.json';
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const INITIAL_CASH_SUPPLY = '2000000';
const ROOT = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';

const fs = require('fs').promises;
const path = require('path');
const specs = require(SPECS_PATH);

const deploy = async () => {
  try {
    // deploy tokens
    const weth = await WETH.new();
    const erc20s = [await ERC20.new(ROOT, INITIAL_CASH_SUPPLY), await ERC20.new(ROOT, INITIAL_CASH_SUPPLY)];
    await weth.deposit({ value: INITIAL_CASH_SUPPLY });
    // deploy Uniswap infrastructure
    const factory = await UniswapV2Factory.new(NULL_ADDRESS);
    const router = await UniswapV2Router.new(factory.address, weth.address);
    await factory.createPair(erc20s[0].address, erc20s[1].address);
    await factory.createPair(weth.address, erc20s[0].address);
    // deploy proxy
    const proxy = await UniswapProxy.new();
    // save data
    const deployed = {
      weth: weth.address,
      erc20s: [erc20s[0].address, erc20s[1].address],
      router: router.address,
      proxy: proxy.address,
    };
    await fs.writeFile(path.join(__dirname, DEPLOYED_PATH), JSON.stringify(deployed), 'utf8');
    // save specs
    specs.CustomSchemes[0].address = proxy.address;
    specs.CustomSchemes[0].params[0] = router.address;

    await fs.writeFile(path.join(__dirname, SPECS_PATH), JSON.stringify(specs), 'utf8');
    console.log('Contracts successfully deployed!');
  } catch (e) {
    console.log(e);
  }
};

module.exports = async (callback) => {
  await deploy();
  callback();
};
