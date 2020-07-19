const UniswapScheme = artifacts.require('UniswapScheme');
const TestTarget = artifacts.require('TestTarget');
const DaoCreator = artifacts.require('./DaoCreator.sol');
const ControllerCreator = artifacts.require('./ControllerCreator.sol');
const DAOTracker = artifacts.require('./DAOTracker.sol');
const Avatar = artifacts.require('./Avatar.sol');
const constants = require('./helpers/constants');
import * as helpers from './helpers';

const deploy = async (accounts) => {
  // initialize test setup
  const setup = new helpers.TestSetup();
  // deploy base contracts
  const controllerCreator = await ControllerCreator.new({ gas: constants.ARC_GAS_LIMIT });
  const daoTracker = await DAOTracker.new({ gas: constants.ARC_GAS_LIMIT });
  setup.daoCreator = await DaoCreator.new(controllerCreator.address, daoTracker.address, { gas: constants.ARC_GAS_LIMIT });
  // deploy organization
  setup.reputations = [2000, 4000, 7000];
  setup.org = await helpers.setupOrganizationWithArrays(setup.daoCreator, [accounts[0], accounts[1], accounts[2]], [1000, 0, 0], setup.reputations);
  // deploy uniswap scheme
  setup.uniswap = await UniswapScheme.new();
  // initialize uniswap scheme
  setup.votingMachine = await helpers.setupAbsoluteVote(helpers.NULL_ADDRESS, 50, setup.uniswap.address);
  await setup.uniswap.initialize(setup.org.avatar.address, setup.votingMachine.absoluteVote.address, setup.votingMachine.params);
  // register uniswap scheme
  const permissions = '0x00000000';
  await setup.daoCreator.setSchemes(setup.org.avatar.address, [setup.uniswap.address], [helpers.NULL_HASH], [permissions], 'metaData');
  // deploy test target contract
  setup.target = await TestTarget.new();
  return setup;
};

contract('UniswapScheme', (accounts) => {
  let setup;
  before('!! deploy DAO', async () => {
    setup = await deploy(accounts);
  });

  context('# initialize', () => {
    it('it initializes scheme', async () => {
      assert.equal(await setup.uniswap.avatar(), setup.org.avatar.address);
      assert.equal(await setup.uniswap.votingMachine(), setup.votingMachine.absoluteVote.address);
      assert.equal(await setup.uniswap.voteParams(), setup.votingMachine.params);
    });

    it('it accepts proposal', async () => {
      const tx = await setup.uniswap.swapETHForToken(setup.target.address, 'YOLO');
      const proposalId = await helpers.getValueFromLogs(tx, 'proposalId', 0);

      const tx2 = await setup.votingMachine.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });

      console.log(tx2.logs);
    });
  });
});
