const ERC20 = artifacts.require('ERC20Mock');
const ControllerCreator = artifacts.require('./ControllerCreator.sol');
const DaoCreator = artifacts.require('./DaoCreator.sol');
const DAOTracker = artifacts.require('./DAOTracker.sol');
const UniswapProxy = artifacts.require('UniswapProxy');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router = artifacts.require('UniswapV2Router');
const WETH = artifacts.require('WETH');
const GenericScheme = artifacts.require('GenericScheme');
import * as helpers from './index';
const constants = require('./constants');

const INITIAL_CASH_SUPPLY = '2000000000000000000000';
const INITIAL_CASH_BALANCE = '100000000000000';
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
  await weth.deposit({ value: INITIAL_CASH_BALANCE });

  return { weth, erc20s };
};

export const uniswap = async (setup) => {
  // deploy unisswap infrastructure
  const factory = await UniswapV2Factory.new(helpers.NULL_ADDRESS);
  const router = await UniswapV2Router.new(factory.address, setup.tokens.weth.address);
  // create uniswap pairs
  await factory.createPair(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
  await factory.createPair(setup.tokens.weth.address, setup.tokens.erc20s[0].address);
  // seed liquidity
  await setup.tokens.erc20s[0].approve(router.address, INITIAL_CASH_BALANCE);
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
  await setup.tokens.weth.approve(router.address, INITIAL_CASH_BALANCE);
  await setup.tokens.erc20s[0].approve(router.address, INITIAL_CASH_BALANCE);
  await router.addLiquidity(
    setup.tokens.weth.address,
    setup.tokens.erc20s[0].address,
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
  await web3.eth.sendTransaction({ from: setup.root, to: organization.avatar.address, value: INITIAL_CASH_BALANCE });

  return organization;
};

export const proxy = async (setup) => {
  // deploy proxy
  const proxy = await UniswapProxy.new();
  // initialize proxy
  await proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address);

  return proxy;
};

export const scheme = async (setup) => {
  // deploy scheme
  const scheme = await GenericScheme.new();
  // deploy scheme voting machine
  scheme.voting = await helpers.setupAbsoluteVote(helpers.NULL_ADDRESS, 50, scheme.address);
  // initialize scheme
  await scheme.initialize(setup.organization.avatar.address, scheme.voting.absoluteVote.address, scheme.voting.params, setup.proxy.address);
  // register scheme
  const permissions = '0x00000010';
  await setup.DAOStack.daoCreator.setSchemes(
    setup.organization.avatar.address,
    [setup.proxy.address, scheme.address],
    [helpers.NULL_HASH, helpers.NULL_HASH],
    [permissions, permissions],
    'metaData'
  );

  return scheme;
};
