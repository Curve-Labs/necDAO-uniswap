const sha3 = require('js-sha3').keccak_256;
const setup = require('./setup');

function getNewProposalId(tx) {
  return getValueFromLogs(tx, 'proposalId', 'NewProposal');
}

function assertExternalEvent(tx, eventName, instances = 1) {
  const events = tx.receipt.rawLogs.filter((l) => {
    return l.topics[0] === '0x' + sha3(eventName);
  });
  assert.equal(events.length, instances, `'${eventName}' event should have been fired ${instances} times`);
  return events;
}

function getValueFromExternalSwapEvent(tx, index = 0) {
  const event = tx.receipt.rawLogs.filter((l) => {
    return l.topics[0] === '0x' + sha3('Swap(address,address,uint256,uint256,uint256)');
  })[index];

  return web3.eth.abi.decodeLog(
    [
      {
        type: 'address',
        name: 'from',
      },
      {
        type: 'address',
        name: 'to',
      },
      {
        type: 'uint256',
        name: 'amount',
      },
      {
        type: 'uint256',
        name: 'expected',
      },
      {
        type: 'uint256',
        name: 'returned',
      },
    ],
    event.data,
    [event.topics]
  );
}

function getValueFromLogs(tx, arg, eventName, index = 0) {
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
}

module.exports = {
  setup,
  getNewProposalId,
  assertExternalEvent,
  getValueFromExternalSwapEvent,
  getValueFromLogs,
};
