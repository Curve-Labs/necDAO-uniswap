import { assert } from 'chai';
import * as helpers from './helpers';
const UniswapProxy = artifacts.require('UniswapProxy');

const encodeSwap = (from, to, amount, expected) => {
  return new web3.eth.Contract(UniswapProxy.abi).methods.swap(from, to, amount, expected).encodeABI();
};

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
  // deploy uniswap scheme
  setup.scheme = await helpers.setup.scheme(setup);

  return setup;
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
      context('> and swap is triggered by the avatar', () => {
        context('> and swap returns enough tokens', () => {
          context('> ERC20 to ERC20', () => {
            let tx,
              balances = [];
            before('!! execute swap', async () => {
              balances[0] = (await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber();
              balances[1] = (await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber();

              const calldata = encodeSwap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
              const _tx = await setup.scheme.proposeCall(calldata, 0, helpers.NULL_HASH);
              const proposalId = helpers.getValueFromLogs(_tx, '_proposalId');
              tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });
            });

            it('it emits a Swap event', async () => {
              helpers.assertExternalEvent(tx, 'Swap(address,address,uint256,uint256,uint256)');
            });

            it('it swaps tokens', async () => {
              assert.isBelow((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber(), balances[0]);
              assert.isAbove((await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber(), balances[1]);
            });
          });
        });
      });

      context('> function is not called by the avatar', () => {
        it('it reverts', async () => {
          await helpers.assertRevert(
            setup.proxy.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500'),
            'UniswapProxy: protected function'
          );
        });
      });
    });
  });
});
