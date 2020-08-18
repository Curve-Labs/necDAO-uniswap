const { assert } = require('chai');
const helpers = require('./helpers');
const UniswapProxy = artifacts.require('UniswapProxy');

const { BN, balance, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const encodeSwap = (from, to, amount, expected) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.swap(from, to, amount, expected).encodeABI();
};

const AMOUNT = new BN('1000');
const EXPECTED = new BN('500');
const RETURNED = new BN('996');

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
  // deploy proxy
  setup.proxy = await helpers.setup.proxy(setup);
  // deploy generic scheme
  setup.scheme = await helpers.setup.scheme(setup);

  return setup;
};

const swap = async (setup, which = 'ERC20s') => {
  switch (which) {
    case 'ERC20s':
      const calldata1 = encodeSwap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, AMOUNT.toString(), EXPECTED.toString());
      const _tx1 = await setup.scheme.proposeCall(calldata1, 0, constants.ZERO_BYTES32);
      const proposalId1 = helpers.getValueFromLogs(_tx1, '_proposalId');
      const tx1 = await setup.scheme.voting.absoluteVote.vote(proposalId1, 1, 0, constants.ZERO_ADDRESS);
      const proposal1 = await setup.scheme.organizationProposals(proposalId1);
      setup.data.tx = tx1;
      setup.data.proposal = proposal1;
      break;
    case 'ETHToERC20':
      const calldata2 = encodeSwap(constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address, AMOUNT.toString(), EXPECTED.toString());
      const _tx2 = await setup.scheme.proposeCall(calldata2, 0, constants.ZERO_BYTES32);
      const proposalId2 = helpers.getValueFromLogs(_tx2, '_proposalId');
      const tx2 = await setup.scheme.voting.absoluteVote.vote(proposalId2, 1, 0, constants.ZERO_ADDRESS);
      const proposal2 = await setup.scheme.organizationProposals(proposalId2);
      setup.data.tx = tx2;
      setup.data.proposal = proposal2;
      break;
    default:
      throw new Error('Unknown swap type');
  }
};

const swapFailed = async (setup, which = 'ERC20s') => {
  switch (which) {
    case 'ERC20s':
      const calldata = encodeSwap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, AMOUNT.toString(), AMOUNT.toString());
      const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
      const proposalId = helpers.getValueFromLogs(_tx, '_proposalId');
      const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
      const proposal = await setup.scheme.organizationProposals(proposalId);
      setup.data.tx = tx;
      setup.data.proposal = proposal;
      break;
    case 'ETHToERC20':
      const calldata2 = encodeSwap(constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address, AMOUNT.toString(), AMOUNT.toString());
      const _tx2 = await setup.scheme.proposeCall(calldata2, 0, constants.ZERO_BYTES32);
      const proposalId2 = helpers.getValueFromLogs(_tx2, '_proposalId');
      const tx2 = await setup.scheme.voting.absoluteVote.vote(proposalId2, 1, 0, constants.ZERO_ADDRESS);
      const proposal2 = await setup.scheme.organizationProposals(proposalId2);
      setup.data.tx = tx2;
      setup.data.proposal = proposal2;
      break;
    default:
      throw new Error('Unknown swap type');
  }
};

contract('UniswapProxy', (accounts) => {
  let setup;
  before('!! deploy setup', async () => {
    setup = await deploy(accounts);
  });

  context('# initialize', () => {
    context('» proxy is not initialized yet', () => {
      // proxy has been initialized during setup
      it('it initializes proxy', async () => {
        expect(await setup.proxy.initialized()).to.equal(true);
        expect(await setup.proxy.avatar()).to.equal(setup.organization.avatar.address);
        expect(await setup.proxy.router()).to.equal(setup.uniswap.router.address);
      });
    });

    context('» proxy is already initialized', () => {
      it('it reverts', async () => {
        await expectRevert(setup.proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address), 'UniswapProxy: proxy already initialized');
      });
    });
  });

  context('# swap', () => {
    context('» proxy is initialized', () => {
      context('» swap is triggered by avatar', () => {
        context('» ERC20 to ERC20', () => {
          context('» swap succeeds', () => {
            before('!! execute swap', async () => {
              setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
              setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);

              await swap(setup);
            });

            it('it emits a Swap event', async () => {
              await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap', {
                from: setup.tokens.erc20s[0].address,
                to: setup.tokens.erc20s[1].address,
                amount: AMOUNT,
                expected: EXPECTED,
                returned: RETURNED,
              });
            });

            it('it swaps tokens', async () => {
              expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0].sub(AMOUNT));
              expect(await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1].add(RETURNED));
            });
          });

          context('» swap fails [return is less than expected]', () => {
            before('!! execute swap', async () => {
              setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
              setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);

              await swapFailed(setup);
            });

            it('it keeps proposal live', async () => {
              expect(setup.data.proposal.exist).to.equal(true);
            });

            it('it emits no Swap event', async () => {
              await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap');
            });

            it('it maintains balances', async () => {
              expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0]);
              expect(await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1]);
            });
          });
        });

        context('» ETH to ERC20', () => {
          context('» swap succeeds', () => {
            before('!! execute swap', async () => {
              setup.data.balances[0] = await balance.current(setup.organization.avatar.address);
              setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);

              await swap(setup, 'ETHToERC20');
            });

            it('it emits a Swap event', async () => {
              await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap', {
                from: constants.ZERO_ADDRESS,
                to: setup.tokens.erc20s[0].address,
                amount: AMOUNT,
                expected: EXPECTED,
                returned: RETURNED,
              });
            });

            it('it swaps tokens', async () => {
              expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0].sub(AMOUNT));
              expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1].add(RETURNED));
            });
          });

          context('» swap fails [return is less than expected]', () => {
            before('!! execute swap', async () => {
              setup.data.balances[0] = new BN(await web3.eth.getBalance(setup.organization.avatar.address));
              setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);

              await swapFailed(setup, 'ETHToERC20');
            });

            it('it keeps proposal live', async () => {
              assert.equal(setup.data.proposal.exist, true);
            });

            it('it emits no Swap event', async () => {
              await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap');
            });

            it('it maintains balances', async () => {
              assert.equal(await web3.eth.getBalance(setup.organization.avatar.address), setup.data.balances[0]);
              assert.equal((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber(), setup.data.balances[1]);
            });
          });
        });
      });

      context('» swap is not triggered by avatar', () => {
        it('it reverts', async () => {
          await expectRevert(setup.proxy.swap(constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address, AMOUNT, EXPECTED), 'UniswapProxy: protected function');
        });
      });
    });
  });
});