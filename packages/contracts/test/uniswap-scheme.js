import { assert } from 'chai';
import * as helpers from './helpers';
const UniswapProxy = artifacts.require('UniswapProxy');
const {
  BN, // Big Number support
} = require('@openzeppelin/test-helpers');

const encodeSwap = (from, to, amount, expected) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.swap(from, to, amount, expected).encodeABI();
};

const AMOUNT = new BN('1000');
const EXPECTED = new BN('500');

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
      const calldata = encodeSwap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, AMOUNT.toString(), EXPECTED.toString());
      const _tx = await setup.scheme.proposeCall(calldata, 0, helpers.NULL_HASH);
      const proposalId = helpers.getValueFromLogs(_tx, '_proposalId');
      const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS);
      const proposal = await setup.scheme.organizationProposals(proposalId);
      setup.data.tx = tx;
      setup.data.proposal = proposal;
      break;
    default:
      throw new Error('Unknown swap type');
  }
};

const swapFailed = async (setup, which = 'ERC20s') => {
  switch (which) {
    case 'ERC20s':
      const calldata = encodeSwap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, AMOUNT.toString(), AMOUNT.toString());
      const _tx = await setup.scheme.proposeCall(calldata, 0, helpers.NULL_HASH);
      const proposalId = helpers.getValueFromLogs(_tx, '_proposalId');
      const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS);
      const proposal = await setup.scheme.organizationProposals(proposalId);
      setup.data.tx = tx;
      setup.data.proposal = proposal;
      break;
    default:
      throw new Error('Unknown swap type');
  }
};

contract('UniswapScheme', (accounts) => {
  let setup;
  before('!! deploy setup', async () => {
    setup = await deploy(accounts);
  });

  context('# initialize', () => {
    context('> scheme is not initialized yet', () => {
      it('it initializes scheme', async () => {
        // scheme has been initialized at setup
        assert.equal(await setup.proxy.initialized(), true);
        assert.equal(await setup.proxy.avatar(), setup.organization.avatar.address);
        assert.equal(await setup.proxy.router(), setup.uniswap.router.address);
        // assert.equal(await setup.scheme.votingMachine(), setup.scheme.voting.absoluteVote.address);
        // assert.equal(await setup.scheme.voteParams(), setup.scheme.voting.params);
      });
    });

    context('> scheme is already initialized', () => {
      it('it reverts', async () => {
        await helpers.assertRevert(
          setup.proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address),
          'UniswapProxy: proxy already initialized'
        );
      });
    });
  });

  context('# swap', () => {
    context('> proxy is initialized', () => {
      context('> swap is triggered by avatar', () => {
        context('> ERC20 to ERC20', () => {
          context('> swap returns enough tokens', () => {
            before('!! execute swap', async () => {
              setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
              setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);

              await swap(setup);
            });

            it('it emits a Swap event', async () => {
              helpers.assertExternalEvent(setup.data.tx, 'Swap(address,address,uint256,uint256,uint256)');
              const event = helpers.getValueFromExternalSwapEvent(setup.data.tx);

              assert.equal(event.from, setup.tokens.erc20s[0].address);
              assert.equal(event.to, setup.tokens.erc20s[1].address);
              assert.equal(event.amount, AMOUNT);
              assert.equal(event.expected, EXPECTED);
              assert.isAbove(Number(event.returned), 0);
            });

            it('it swaps tokens', async () => {
              const returned = new BN(helpers.getValueFromExternalSwapEvent(setup.data.tx).returned);
              assert.equal((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber(), setup.data.balances[0].sub(AMOUNT));
              assert.equal((await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber(), setup.data.balances[1].add(returned));
            });
          });

          context('> swap does not return enough tokens', () => {
            before('!! execute swap', async () => {
              setup.data.balances[0] = (await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber();
              setup.data.balances[1] = (await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber();

              await swapFailed(setup);
            });

            it('it reverts [proposal is still live]', async () => {
              assert.equal(setup.data.proposal.exist, true);
            });

            it('it reverts [balances are constants]', async () => {
              assert.equal((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber(), setup.data.balances[0]);
              assert.equal((await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber(), setup.data.balances[1]);
            });
          });
        });
      });

      context('> swap is not triggered by avatar', () => {
        it('it reverts', async () => {
          await helpers.assertRevert(
            setup.proxy.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, AMOUNT, EXPECTED),
            'UniswapProxy: protected function'
          );
        });
      });
    });
  });
});
