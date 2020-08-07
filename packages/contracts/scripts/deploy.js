const ERC20 = artifacts.require('ERC20Mock');
const UniswapScheme = artifacts.require('UniswapScheme');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router = artifacts.require('UniswapV2Router02');
const WETH = artifacts.require('WETH9');

// const DAOstackMigration = require('@daostack/migration');
// const migrationSpec = require('../data/necDAO.json');
const fs = require('fs').promises;
var path = require('path');
// require('dotenv').config();

const DATA_PATH = './deployed.json';
// const MIGRATION_PATH = '../../migration/migration.json';
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const INITIAL_CASH_SUPPLY = '2000000';
const ROOT = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';

// const options = {
//   //   provider: process.env.PROVIDER,
//   gasPrice: 3.5,
//   gasLimit: 9990000,
//   quiet: false,
//   force: true,
//   restart: true,
//   // output: './data/migration.json',
//   mnemonic: process.env.MNEMONIC,
//   //   customAbisLocation: process.env.CUSTOM_ABI_LOCATION,
//   params: {
//     // migrationSpec,
//     private: migrationSpec,
//     rinkeby: migrationSpec,
//   },
// };

const deploy = async () => {
  const weth = await WETH.new();
  console.log('ETH');
  const erc20s = [await ERC20.new(ROOT, INITIAL_CASH_SUPPLY), await ERC20.new(ROOT, INITIAL_CASH_SUPPLY)];
  console.log('ERC30');
  try {
    await weth.deposit({ value: INITIAL_CASH_SUPPLY });
    console.log('deposited');

    const factory = await UniswapV2Factory.new(NULL_ADDRESS);
    const router = await UniswapV2Router.new(factory.address, weth.address);
    await factory.createPair(erc20s[0].address, erc20s[1].address);
    await factory.createPair(weth.address, erc20s[0].address);
    console.log('pair cfreated');

    const scheme = await UniswapScheme.new();
    const deployed = {
      weth: weth.address,
      erc20s: [erc20s[0].address, erc20s[1].address],
      router: router.address,
      scheme: scheme.address,
    };
    await fs.writeFile(path.join(__dirname, DATA_PATH), JSON.stringify(deployed), 'utf8');
  } catch (e) {
    console.log(e);
  }
};

const save = async (data) => {
  // On a pas besoin de modifier migration.json
  // Il faut simplement update les valeurs dans subgraph/daos/private/testdao45.json [renommé en necDAO.json]

  // unregister deprecated base contracts to optimize subgraph indexation
  migration.private.base = { '0.0.1-rc.44': migration.private.base['0.0.1-rc.44'] };
  // unregister deprecated DAOs to optimize subgraph indexation
  migration.private.dao = { '0.0.1-rc.44': migration.private.dao['0.0.1-rc.44'] };
  // unregister deprecated tests to optimize subgraph indexation
  migration.private.test = { '0.0.1-rc.44': migration.private.test['0.0.1-rc.44'] };
  // save optimized @daostack/migration migration.json file
};

module.exports = async function(callback) {
  // perform actions
  // const weth = WETH.new();
  // console.log('coucou');
  await deploy();
  callback();
};
