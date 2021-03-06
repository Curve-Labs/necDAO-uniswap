const ERC20 = artifacts.require('ERC20Mock');
const ControllerCreator = artifacts.require('./ControllerCreator.sol');
const DaoCreator = artifacts.require('./DaoCreator.sol');
const DAOTracker = artifacts.require('./DAOTracker.sol');
const UniswapProxy = artifacts.require('UniswapProxy');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router = artifacts.require('UniswapV2Router');
const WETH = artifacts.require('WETH');
const GenericScheme = artifacts.require('GenericScheme');
const Avatar = artifacts.require('./Avatar.sol');
const DAOToken = artifacts.require('./DAOToken.sol');
const Reputation = artifacts.require('./Reputation.sol');
const AbsoluteVote = artifacts.require('./AbsoluteVote.sol');

const { constants, ether } = require('@openzeppelin/test-helpers');

const INITIAL_CASH_BALANCE = ether('50');
const DAO_TOKENS = '100';
const REPUTATION = '1000';

const deployOrganization = async (daoCreator, daoCreatorOwner, founderToken, founderReputation, cap = 0) => {
  var org = {};
  var tx = await daoCreator.forgeOrg('testOrg', 'TEST', 'TST', daoCreatorOwner, founderToken, founderReputation, cap, { gas: constants.ARC_GAS_LIMIT });
  assert.equal(tx.logs.length, 1);
  assert.equal(tx.logs[0].event, 'NewOrg');
  var avatarAddress = tx.logs[0].args._avatar;
  org.avatar = await Avatar.at(avatarAddress);
  var tokenAddress = await org.avatar.nativeToken();
  org.token = await DAOToken.at(tokenAddress);
  var reputationAddress = await org.avatar.nativeReputation();
  org.reputation = await Reputation.at(reputationAddress);
  return org;
};

const setAbsoluteVote = async (voteOnBehalf = constants.ZERO_ADDRESS, precReq = 50) => {
  var votingMachine = {};
  votingMachine.absoluteVote = await AbsoluteVote.new();
  // register some parameters
  await votingMachine.absoluteVote.setParameters(precReq, voteOnBehalf);
  votingMachine.params = await votingMachine.absoluteVote.getParametersHash(precReq, voteOnBehalf);
  return votingMachine;
};

const initialize = async (root) => {
  const setup = {};
  setup.root = root;
  setup.data = {};
  setup.data.balances = [];
  return setup;
};

const tokens = async (setup) => {
  const weth = await WETH.new();
  const erc20s = [await ERC20.new('DAI Stablecoin', 'DAI', 18), await ERC20.new('USDC Stablecoin', 'USDC', 15)];
  await weth.deposit({ value: INITIAL_CASH_BALANCE });

  return { weth, erc20s };
};

const uniswap = async (setup) => {
  // deploy uniswap infrastructure
  const factory = await UniswapV2Factory.new(constants.ZERO_ADDRESS);
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

  await setup.tokens.erc20s[0].approve(router.address, INITIAL_CASH_BALANCE);
  await router.addLiquidityETH(
    setup.tokens.erc20s[0].address,
    INITIAL_CASH_BALANCE,
    INITIAL_CASH_BALANCE,
    INITIAL_CASH_BALANCE,
    setup.root,
    timestamp + 10000000,
    {
      value: INITIAL_CASH_BALANCE,
    }
  );

  const liquidityTokenERC20s = await ERC20.at(await factory.getPair(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address));
  const liquidityTokenERC20ETH = await ERC20.at(await factory.getPair(setup.tokens.erc20s[0].address, setup.tokens.weth.address));

  return { factory, router, liquidityTokenERC20s, liquidityTokenERC20ETH };
};

const DAOStack = async () => {
  const controllerCreator = await ControllerCreator.new();
  const daoTracker = await DAOTracker.new();
  const daoCreator = await DaoCreator.new(controllerCreator.address, daoTracker.address);

  return { controllerCreator, daoTracker, daoCreator };
};

const organization = async (setup) => {
  // deploy organization
  const organization = await deployOrganization(setup.DAOStack.daoCreator, [setup.root], [DAO_TOKENS], [REPUTATION]);
  // transfer remaining of roots' balances to the organization avatar
  await setup.tokens.erc20s[0].transfer(organization.avatar.address, INITIAL_CASH_BALANCE);
  await setup.tokens.erc20s[1].transfer(organization.avatar.address, INITIAL_CASH_BALANCE);
  await web3.eth.sendTransaction({ from: setup.root, to: organization.avatar.address, value: INITIAL_CASH_BALANCE });

  return organization;
};

const proxy = async (setup) => {
  // deploy proxy
  const proxy = await UniswapProxy.new();
  // initialize proxy
  await proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address);

  return proxy;
};

const scheme = async (setup) => {
  // deploy scheme
  const scheme = await GenericScheme.new();
  // deploy scheme voting machine
  scheme.voting = await setAbsoluteVote(constants.ZERO_ADDRESS, 50, scheme.address);
  // initialize scheme
  await scheme.initialize(setup.organization.avatar.address, scheme.voting.absoluteVote.address, scheme.voting.params, setup.proxy.address);
  // register scheme
  const permissions = '0x00000010';
  await setup.DAOStack.daoCreator.setSchemes(
    setup.organization.avatar.address,
    [setup.proxy.address, scheme.address],
    [constants.ZERO_BYTES32, constants.ZERO_BYTES32],
    [permissions, permissions],
    'metaData'
  );

  return scheme;
};

module.exports = {
  initialize,
  tokens,
  uniswap,
  DAOStack,
  organization,
  proxy,
  scheme,
};
