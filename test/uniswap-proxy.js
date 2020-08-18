const { expect } = require('chai');
const { BN, balance, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const helpers = require('./helpers');
const UniswapProxy = artifacts.require('UniswapProxy');

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

contract('UniswapProxy', (accounts) => {
  let setup;
  before('!! deploy setup', async () => {
    setup = await deploy(accounts);
  });

  context('# initialize', () => {
    context('» proxy is not initialized yet', () => {
      context('» parameters are valid', () => {
        // proxy has already been initialized during setup
        it('it initializes proxy', async () => {
          expect(await setup.proxy.initialized()).to.equal(true);
          expect(await setup.proxy.avatar()).to.equal(setup.organization.avatar.address);
          expect(await setup.proxy.router()).to.equal(setup.uniswap.router.address);
        });
      });

      context('» avatar parameter is not valid', () => {
        before('!! deploy proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
        });

        it('it reverts', async () => {
          await expectRevert(setup.data.proxy.initialize(constants.ZERO_ADDRESS, setup.uniswap.router.address), 'UniswapProxy: avatar cannot be null');
        });
      });

      context('» router parameter is not valid', () => {
        before('!! deploy proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
        });

        it('it reverts', async () => {
          await expectRevert(setup.data.proxy.initialize(setup.organization.avatar.address, constants.ZERO_ADDRESS), 'UniswapProxy: router cannot be null');
        });
      });
    });

    context('» proxy is already initialized', () => {
      // proxy has already been initialized during setup
      it('it reverts', async () => {
        await expectRevert(setup.proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address), 'UniswapProxy: proxy already initialized');
      });
    });
  });

  context('# swap', () => {
    context('» generics', () => {
      context('» proxy is not initialized', () => {
        before('!! deploy proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.swap(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[1].address,
              helpers.values.AMOUNT.toString(),
              helpers.values.EXPECTED.toString()
            ),
            'UniswapProxy: proxy not initialized'
          );
        });
      });

      context('» swap is not triggered by avatar', () => {
        before('!! deploy and initialize proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
          await setup.data.proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address);
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.swap(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[1].address,
              helpers.values.AMOUNT.toString(),
              helpers.values.EXPECTED.toString()
            ),
            'UniswapProxy: protected operation'
          );
        });
      });

      context('» swap amount is invalid', () => {
        before('!! deploy and initialize proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
          await setup.data.proxy.initialize(accounts[0], setup.uniswap.router.address);
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, 0, helpers.values.EXPECTED.toString()),
            'UniswapProxy: invalid swap amount'
          );
        });
      });

      context('» token pair is invalid', () => {
        before('!! deploy and initialize proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
          await setup.data.proxy.initialize(accounts[0], setup.uniswap.router.address);
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.swap(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[0].address,
              helpers.values.AMOUNT.toString(),
              helpers.values.EXPECTED.toString()
            ),
            'UniswapProxy: invalid swap pair'
          );
        });
      });
    });

    context('» ERC20 to ERC20', () => {
      context('» swap succeeds', () => {
        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);
          // execute swap
          const calldata = helpers.encodeSwap(
            setup.tokens.erc20s[0].address,
            setup.tokens.erc20s[1].address,
            helpers.values.AMOUNT.toString(),
            helpers.values.EXPECTED.toString()
          );
          const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
          const proposalId = helpers.getNewProposalId(_tx);
          const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
          const proposal = await setup.scheme.organizationProposals(proposalId);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Swap event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap', {
            from: setup.tokens.erc20s[0].address,
            to: setup.tokens.erc20s[1].address,
            amount: helpers.values.AMOUNT,
            expected: helpers.values.EXPECTED,
            returned: helpers.values.RETURNED,
          });
        });

        it('it swaps tokens', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[0].sub(helpers.values.AMOUNT)
          );
          expect(await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[1].add(helpers.values.RETURNED)
          );
        });
      });

      context('» swap fails [return is less than expected]', () => {
        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);
          // execute failing swap
          const calldata = helpers.encodeSwap(
            setup.tokens.erc20s[0].address,
            setup.tokens.erc20s[1].address,
            helpers.values.AMOUNT.toString(),
            helpers.values.AMOUNT.toString()
          );
          const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
          const proposalId = helpers.getNewProposalId(_tx);
          const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
          const proposal = await setup.scheme.organizationProposals(proposalId);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
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
          // store balances
          setup.data.balances[0] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          // execute swap
          const calldata = helpers.encodeSwap(
            constants.ZERO_ADDRESS,
            setup.tokens.erc20s[0].address,
            helpers.values.AMOUNT.toString(),
            helpers.values.EXPECTED.toString()
          );
          const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
          const proposalId = helpers.getNewProposalId(_tx);
          const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
          const proposal = await setup.scheme.organizationProposals(proposalId);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Swap event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap', {
            from: constants.ZERO_ADDRESS,
            to: setup.tokens.erc20s[0].address,
            amount: helpers.values.AMOUNT,
            expected: helpers.values.EXPECTED,
            returned: helpers.values.RETURNED,
          });
        });

        it('it swaps tokens', async () => {
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0].sub(helpers.values.AMOUNT));
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[1].add(helpers.values.RETURNED)
          );
        });
      });

      context('» swap fails [return is less than expected]', () => {
        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = new BN(await web3.eth.getBalance(setup.organization.avatar.address));
          setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          // execute failing swap
          const calldata = helpers.encodeSwap(
            constants.ZERO_ADDRESS,
            setup.tokens.erc20s[0].address,
            helpers.values.AMOUNT.toString(),
            helpers.values.AMOUNT.toString()
          );
          const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
          const proposalId = helpers.getNewProposalId(_tx);
          const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
          const proposal = await setup.scheme.organizationProposals(proposalId);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it keeps proposal live', async () => {
          expect(setup.data.proposal.exist).to.equal(true);
        });

        it('it emits no Swap event', async () => {
          await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap');
        });

        it('it maintains balances', async () => {
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0]);
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1]);
        });
      });
    });

    context.only('» ERC20 to ETH', () => {
      context('» swap succeeds', () => {
        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await balance.current(setup.organization.avatar.address);
          // execute swap
          const calldata = helpers.encodeSwap(
            setup.tokens.erc20s[0].address,
            constants.ZERO_ADDRESS,
            helpers.values.AMOUNT.toString(),
            helpers.values.EXPECTED.toString()
          );
          const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
          const proposalId = helpers.getNewProposalId(_tx);
          const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
          const proposal = await setup.scheme.organizationProposals(proposalId);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Swap event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap', {
            from: setup.tokens.erc20s[0].address,
            to: constants.ZERO_ADDRESS,
            amount: helpers.values.AMOUNT,
            expected: helpers.values.EXPECTED,
            returned: helpers.values.RETURNED,
          });
        });

        it('it swaps tokens', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[0].sub(helpers.values.AMOUNT)
          );
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1].add(helpers.values.RETURNED));
        });
      });

      context('» swap fails [return is less than expected]', () => {
        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await balance.current(setup.organization.avatar.address);
          // execute swap
          const calldata = helpers.encodeSwap(
            setup.tokens.erc20s[0].address,
            constants.ZERO_ADDRESS,
            helpers.values.AMOUNT.toString(),
            helpers.values.AMOUNT.toString()
          );
          const _tx = await setup.scheme.proposeCall(calldata, 0, constants.ZERO_BYTES32);
          const proposalId = helpers.getNewProposalId(_tx);
          const tx = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, constants.ZERO_ADDRESS);
          const proposal = await setup.scheme.organizationProposals(proposalId);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it keeps proposal live', async () => {
          expect(setup.data.proposal.exist).to.equal(true);
        });

        it('it emits no Swap event', async () => {
          await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap');
        });

        it('it maintains balances', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0]);
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1]);
        });
      });
    });
  });
});
