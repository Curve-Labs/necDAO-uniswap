const UniswapProxy = artifacts.require('UniswapProxy');
const { BN, constants, ether } = require('@openzeppelin/test-helpers');
const setup = require('./setup');

const encodeSwap = (from, to, amount, expected) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.swap(from, to, amount, expected).encodeABI();
};

const encodePool = (token1, token2, amount1, amount2, slippage) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.pool(token1, token2, amount1, amount2, slippage).encodeABI();
};

const encodeUnpool = (token1, token2, amount, expected1, expected2) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.unpool(token1, token2, amount, expected1, expected2).encodeABI();
};

const encodeUpgradeRouter = (router) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.upgradeRouter(router).encodeABI();
};

const getValueFromLogs = (tx, arg, eventName, index = 0) => {
  /**
   *
   * tx.logs look like this:
   *
   * [ { logIndex: 13,
   *     transactionIndex: 0,
   *     transactionHash: '0x999e51b4124371412924d73b60a0ae1008462eb367db45f8452b134e5a8d56c8',
   *     blockHash: '0xe35f7c374475a6933a500f48d4dfe5dce5b3072ad316f64fbf830728c6fe6fc9',
   *     blockNumber: 294,
   *     address: '0xd6a2a42b97ba20ee8655a80a842c2a723d7d488d',
   *     type: 'mined',
   *     event: 'NewOrg',
   *     args: { _avatar: '0xcc05f0cde8c3e4b6c41c9b963031829496107bbb' } } ]
   */
  if (!tx.logs || !tx.logs.length) {
    throw new Error('getValueFromLogs: Transaction has no logs');
  }

  if (eventName !== undefined) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        index = i;
        break;
      }
    }
    if (index === undefined) {
      let msg = `getValueFromLogs: There is no event logged with eventName ${eventName}`;
      throw new Error(msg);
    }
  } else {
    if (index === undefined) {
      index = tx.logs.length - 1;
    }
  }
  let result = tx.logs[index].args[arg];
  if (!result) {
    let msg = `getValueFromLogs: This log does not seem to have a field "${arg}": ${tx.logs[index].args}`;
    throw new Error(msg);
  }
  return result;
};

const getNewProposalId = (tx) => {
  return getValueFromLogs(tx, '_proposalId', 'NewProposal');
};

const swap = async (setup, token1, token2) => {
  const calldata = encodeSwap(token1, token2, values.swap.AMOUNT, values.swap.EXPECTED);
  const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
  const proposalId = getNewProposalId(_tx);
  const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
  const proposal = await setup.scheme.organizationProposals(proposalId);

  return { tx, proposal };
};

const pool = async (setup, token1, token2) => {
  const calldata = encodePool(token1, token2, values.pool.AMOUNT, values.pool.AMOUNT, values.pool.SLIPPAGE);
  const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
  const proposalId = getNewProposalId(_tx);
  const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
  const proposal = await setup.scheme.organizationProposals(proposalId);

  return { tx, proposal };
};

const unpool = async (setup, token1, token2) => {
  const calldata = encodeUnpool(token1, token2, values.unpool.AMOUNT, values.unpool.EXPECTED1, values.unpool.EXPECTED2);
  const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
  const proposalId = getNewProposalId(_tx);
  const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
  const proposal = await setup.scheme.organizationProposals(proposalId);

  return { tx, proposal };
};

const upgradeRouter = async (setup, router) => {
  const calldata = encodeUpgradeRouter(router);
  const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
  const proposalId = getNewProposalId(_tx);
  const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
  const proposal = await setup.scheme.organizationProposals(proposalId);

  return { tx, proposal };
};

const values = {
  PPM: new BN('1000000'),
  swap: {
    AMOUNT: ether('1'),
    EXPECTED: ether('0.9'),
    RETURNED: ether('0.977508480891032805'),
  },
  pool: {
    AMOUNT: ether('10'),
    MIN: ether('9.50'),
    POOLED1: ether('10'),
    POOLED2: ether('9.612253239040973959'),
    RETURNED: ether('9.803921568627450979'),
    SLIPPAGE: new BN('50000'),
  },
  unpool: {
    AMOUNT: ether('9.5'),
    EXPECTED1: ether('9.5'),
    EXPECTED2: ether('9.3'),
    RETURNED1: ether('9.69'),
    RETURNED2: ether('9.314273388630703767'),
  },
};

module.exports = {
  setup,
  encodeSwap,
  encodePool,
  encodeUnpool,
  getNewProposalId,
  swap,
  pool,
  unpool,
  upgradeRouter,
  values,
};
