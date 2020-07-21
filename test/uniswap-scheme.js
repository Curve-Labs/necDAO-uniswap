const TestTarget = artifacts.require('TestTarget');
const DaoCreator = artifacts.require('./DaoCreator.sol');
const ControllerCreator = artifacts.require('./ControllerCreator.sol');
const DAOTracker = artifacts.require('./DAOTracker.sol');
const Avatar = artifacts.require('./Avatar.sol');
const constants = require('./helpers/constants');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const ERC20 = artifacts.require('ERC20Mock');
const WETH = artifacts.require('WETH9');
const UniswapV2Router = artifacts.require('UniswapV2Router02');

import * as helpers from './helpers';

// const deploy = async (accounts) => {
//   // initialize test setup
//   const setup = new helpers.TestSetup();
//   setup.root = accounts[0];
//   setup.reputations = [1000];
//   // deploy WETH and ERC20s
//   setup.tokens = await helpers.setup.tokens(accounts[0]);
//   // deploy uniswap infrastructure
//   setup.uniswap = await helpers.setup.uniswap(setup);
//   // deploy DAOStack meta-contracts
//   setup.daostack = await helpers.setup.DAOStack();
//   // deploy organization
//   // setup.org = await helpers.setupOrganizationWithArrays(setup.daoCreator, [accounts[0], accounts[1], accounts[2]], [1000, 0, 0], setup.reputations);
//   setup.organization = await helpers.setup.organization(setup);
//   // deploy ERC20s
//   setup.tokens = [await ERC20.new(accounts[0], 20000000000), await ERC20.new(accounts[0], 20000000000)];
//   // create uniswap pair
//   const tx = await setup.factory.createPair(setup.tokens[0].address, setup.tokens[1].address);
//   setup.pair = await helpers.getValueFromLogs(tx, 'pair', 0);
//   // deploy uniswap scheme
//   setup.uniswap = await UniswapScheme.new();
//   // initialize uniswap scheme
//   setup.votingMachine = await helpers.setupAbsoluteVote(helpers.NULL_ADDRESS, 50, setup.uniswap.address);
//   await setup.uniswap.initialize(setup.org.avatar.address, setup.votingMachine.absoluteVote.address, setup.votingMachine.params, setup.factory.address);
//   // register uniswap scheme
//   const permissions = '0x0000001f';
//   await setup.daoCreator.setSchemes(setup.org.avatar.address, [setup.uniswap.address], [helpers.NULL_HASH], [permissions], 'metaData');
//   // seed liquidity to the uniswap pair
//   const AMOUNT = 10000000000;
//   await setup.tokens[0].approve(setup.router.address, AMOUNT);
//   const tx2 = await setup.tokens[1].approve(setup.router.address, AMOUNT);
//   const timestamp = (await web3.eth.getBlock(tx2.receipt.blockNumber)).timestamp;
//   await setup.router.addLiquidity(setup.tokens[0].address, setup.tokens[1].address, AMOUNT, AMOUNT, AMOUNT, AMOUNT, accounts[0], timestamp + 10000000);
//   // transfer the remaining of the tokens to the avatar
//   await setup.tokens[0].transfer(setup.org.avatar.address, AMOUNT);
//   await setup.tokens[1].transfer(setup.org.avatar.address, AMOUNT);
//   // deploy test target contract
//   setup.target = await TestTarget.new();
//   return setup;
// };

const deploy = async (accounts) => {
  // initialize test setup
  const setup = await helpers.setup.initialize(accounts[0]);
  // deploy WETH and ERC20s
  setup.tokens = await helpers.setup.tokens(setup);
  // deploy uniswap infrastructure
  setup.uniswap = await helpers.setup.uniswap(setup);
  // deploy DAOStack meta-contracts
  setup.DAOStack = await helpers.setup.DAOStack(setup);
  // deploy organization
  setup.organization = await helpers.setup.organization(setup);
  // deploy uniswap scheme
  setup.scheme = await helpers.setup.scheme(setup);
  // deploy test target contract
  setup.target = await TestTarget.new();
  return setup;
};

contract('UniswapScheme', (accounts) => {
  let setup;
  before('!! deploy DAO', async () => {
    setup = await deploy(accounts);

    console.log('Pair: ' + setup.pair);
  });

  context('# initialize', () => {
    it('it computes pair', async () => {
      const tx = await setup.scheme.test(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);

      console.log(await helpers.getValueFromLogs(tx, 'pair', 0));
    });

    it('it initializes scheme', async () => {
      assert.equal(await setup.scheme.avatar(), setup.organization.avatar.address);
      assert.equal(await setup.scheme.votingMachine(), setup.scheme.voting.absoluteVote.address);
      assert.equal(await setup.scheme.voteParams(), setup.scheme.voting.params);
    });

    it('it accepts proposal', async () => {
      // const tx = await setup.uniswap.swapETHForToken(setup.target.address, 'YOLO');
      // const proposalId = await helpers.getValueFromLogs(tx, 'proposalId', 0);
      // const tx2 = await setup.votingMachine.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });
      // const tx3 = await setup.uniswap.execute(proposalId);
      // console.log('TX2');
      // console.log(tx2.logs);
      // console.log('TX3');
      // console.log(tx3.receipt.rawLogs);
      // console.log(await setup.target.value());
    });
  });
});
