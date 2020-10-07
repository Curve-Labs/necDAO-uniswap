const { BN } = require('@openzeppelin/test-helpers');
const setup = require('./setup');
const UniswapProxy = artifacts.require('UniswapProxy');

const encodeSwap = (from, to, amount, expected) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.swap(from, to, amount, expected).encodeABI();
};

const encodePool = (token1, token2, amount1, amount2, slippage) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.pool(token1, token2, amount1, amount2, slippage).encodeABI();
};

const encodeUnpool = (token1, token2, amount, expected1, expected2) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.unpool(token1, token2, amount, expected1, expected2).encodeABI();
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

module.exports = {
  setup,
  encodeSwap,
  encodePool,
  encodeUnpool,
  getNewProposalId,
  values: {
    PPM: new BN('1000000'),
    swap: {
      AMOUNT: new BN('1000'),
      EXPECTED: new BN('500'),
      RETURNED: new BN('996'),
      UNBALANCE_ETH: new BN('1000000000000'),
    },
    pool: {
      AMOUNT: new BN('1000'),
      MIN: new BN('950'),
      POOLED1: new BN('1000'),
      POOLED2: new BN('999'),
      POOLED_WITH_ETH: new BN('980'),
      RETURNED: new BN('999'),
      RETURNED_ETH: new BN('989'),
      SLIPPAGE: new BN('50000'),
    },
    unpool: {
      AMOUNT: new BN('900'),
      EXPECTED1: new BN('900'),
      EXPECTED2: new BN('850'),
      EXPECTED_WITH_ETH: new BN('980'),
      RETURNED1: new BN('900'),
      RETURNED2: new BN('899'),
      RETURNED_ETH: new BN('989'),
    },
  },
};
