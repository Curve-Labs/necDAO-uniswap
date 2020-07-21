const ERC20 = artifacts.require('ERC20Mock');
const ControllerCreator = artifacts.require('./ControllerCreator.sol');
const DaoCreator = artifacts.require('./DaoCreator.sol');
const DAOTracker = artifacts.require('./DAOTracker.sol');
const UniswapScheme = artifacts.require('UniswapScheme');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router = artifacts.require('UniswapV2Router02');
const WETH = artifacts.require('WETH9');
import * as helpers from './index';
const constants = require('./constants');

const INITIAL_CASH_SUPPLY = '2000000000000000000000';
const INITIAL_CASH_BALANCE = '1000000000000000000000';
const DAO_TOKENS = '100';
const REPUTATION = '1000';

export const initialize = async (root) => {
  const setup = new helpers.TestSetup();
  setup.root = root;

  return setup;
};

export const tokens = async (setup) => {
  const weth = await WETH.new();
  const erc20s = [await ERC20.new(setup.root, INITIAL_CASH_SUPPLY), await ERC20.new(setup.root, INITIAL_CASH_SUPPLY)];

  return { weth, erc20s };
};

export const uniswap = async (setup) => {
  // deploy unisswap infrastructure
  const factory = await UniswapV2Factory.new(helpers.NULL_ADDRESS);
  const router = await UniswapV2Router.new(factory.address, setup.tokens.weth.address);
  // create uniswap pairs
  await factory.createPair(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
  // const pair = await helpers.getValueFromLogs(tx, 'pair', 0);
  // seed liquidity
  const tx1 = await setup.tokens.erc20s[0].approve(router.address, INITIAL_CASH_BALANCE);
  const tx2 = await setup.tokens.erc20s[1].approve(router.address, INITIAL_CASH_BALANCE);
  const timestamp = (await web3.eth.getBlock(tx2.receipt.blockNumber)).timestamp;
  await router.addLiquidity(
    setup.tokens.erc20s[0].address,
    setup.tokens.erc20s[1].address,
    INITIAL_CASH_BALANCE,
    INITIAL_CASH_BALANCE,
    INITIAL_CASH_BALANCE,
    INITIAL_CASH_BALANCE,
    setup.root,
    timestamp + 10000000
  );

  return { factory, router };
};

export const DAOStack = async () => {
  const controllerCreator = await ControllerCreator.new({ gas: constants.ARC_GAS_LIMIT });
  const daoTracker = await DAOTracker.new({ gas: constants.ARC_GAS_LIMIT });
  const daoCreator = await DaoCreator.new(controllerCreator.address, daoTracker.address, { gas: constants.ARC_GAS_LIMIT });

  return { controllerCreator, daoTracker, daoCreator };
};

export const organization = async (setup) => {
  // deploy organization
  const organization = await helpers.setupOrganizationWithArrays(setup.DAOStack.daoCreator, [setup.root], [DAO_TOKENS], [REPUTATION]);
  // transfer remaining of roots' balances to the organization avatar
  await setup.tokens.erc20s[0].transfer(organization.avatar.address, INITIAL_CASH_BALANCE);
  await setup.tokens.erc20s[1].transfer(organization.avatar.address, INITIAL_CASH_BALANCE);

  return organization;
};

export const scheme = async (setup) => {
  // deploy scheme
  const scheme = await UniswapScheme.new();
  // deploy scheme voting machine
  scheme.voting = await helpers.setupAbsoluteVote(helpers.NULL_ADDRESS, 50, scheme.address);
  console.log(scheme.voting);
  // initialize scheme
  await scheme.initialize(setup.organization.avatar.address, scheme.voting.absoluteVote.address, scheme.voting.params, setup.uniswap.factory.address);
  // register scheme
  const permissions = '0x0000001f';
  await setup.DAOStack.daoCreator.setSchemes(setup.organization.avatar.address, [scheme.address], [helpers.NULL_HASH], [permissions], 'metaData');

  return scheme;
};
