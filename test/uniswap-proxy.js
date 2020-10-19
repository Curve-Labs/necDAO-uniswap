const UniswapProxy = artifacts.require('UniswapProxy');
const { expect } = require('chai');
const { BN, balance, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const helpers = require('./helpers');

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
    before('!! deploy setup', async () => {
      setup = await deploy(accounts);
    });

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
        await expectRevert(setup.proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address), 'UniswapProxy: already initialized');
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
            setup.data.proxy.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, helpers.values.swap.AMOUNT, helpers.values.swap.EXPECTED),
            'UniswapProxy: not initialized'
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
            setup.data.proxy.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, helpers.values.swap.AMOUNT, helpers.values.swap.EXPECTED),
            'UniswapProxy: protected operation'
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
            setup.data.proxy.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[0].address, helpers.values.swap.AMOUNT, helpers.values.swap.EXPECTED),
            'UniswapProxy: invalid pair'
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
            setup.data.proxy.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, 0, helpers.values.swap.EXPECTED),
            'UniswapProxy: invalid amount'
          );
        });
      });
    });

    context('» ERC20 to ERC20', () => {
      context('» swap succeeds', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);
          // execute swap
          const { tx, proposal } = await helpers.swap(setup, setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Swap event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap', {
            from: setup.tokens.erc20s[0].address,
            to: setup.tokens.erc20s[1].address,
            amount: helpers.values.swap.AMOUNT,
            expected: helpers.values.swap.EXPECTED,
            returned: helpers.values.swap.RETURNED,
          });
        });

        it('it swaps tokens', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[0].sub(helpers.values.swap.AMOUNT)
          );
          expect(await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[1].add(helpers.values.swap.RETURNED)
          );
        });
      });

      context('» swap fails [return is less than expected]', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);
          // execute failing swap
          const calldata = helpers.encodeSwap(
            setup.tokens.erc20s[0].address,
            setup.tokens.erc20s[1].address,
            helpers.values.swap.AMOUNT,
            helpers.values.swap.RETURNED.add(new BN('1'))
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
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          // execute swap
          const { tx, proposal } = await helpers.swap(setup, constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Swap event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap', {
            from: constants.ZERO_ADDRESS,
            to: setup.tokens.erc20s[0].address,
            amount: helpers.values.swap.AMOUNT,
            expected: helpers.values.swap.EXPECTED,
            returned: helpers.values.swap.RETURNED,
          });
        });

        it('it swaps tokens', async () => {
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0].sub(helpers.values.swap.AMOUNT));
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[1].add(helpers.values.swap.RETURNED)
          );
        });
      });

      context('» swap fails [return is less than expected]', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = new BN(await web3.eth.getBalance(setup.organization.avatar.address));
          setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          // execute failing swap
          const calldata = helpers.encodeSwap(
            constants.ZERO_ADDRESS,
            setup.tokens.erc20s[0].address,
            helpers.values.swap.AMOUNT,
            helpers.values.swap.RETURNED.add(new BN('1'))
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

    context('» ERC20 to ETH', () => {
      context('» swap succeeds', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await balance.current(setup.organization.avatar.address);
          // execute swap
          const { tx, proposal } = await helpers.swap(setup, setup.tokens.erc20s[0].address, constants.ZERO_ADDRESS);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Swap event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Swap', {
            from: setup.tokens.erc20s[0].address,
            to: constants.ZERO_ADDRESS,
            amount: helpers.values.swap.AMOUNT,
            expected: helpers.values.swap.EXPECTED,
            returned: helpers.values.swap.RETURNED,
          });
        });

        it('it swaps tokens', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[0].sub(helpers.values.swap.AMOUNT)
          );
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1].add(helpers.values.swap.RETURNED));
        });
      });

      context('» swap fails [return is less than expected]', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await balance.current(setup.organization.avatar.address);
          // execute swap
          const calldata = helpers.encodeSwap(
            setup.tokens.erc20s[0].address,
            constants.ZERO_ADDRESS,
            helpers.values.swap.AMOUNT,
            helpers.values.swap.RETURNED.add(new BN('1'))
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

  context('# pool', () => {
    context('» generics', () => {
      context('» proxy is not initialized', () => {
        before('!! deploy proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.pool(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[1].address,
              helpers.values.pool.AMOUNT,
              helpers.values.pool.AMOUNT,
              helpers.values.pool.SLIPPAGE
            ),
            'UniswapProxy: not initialized'
          );
        });
      });

      context('» pool is not triggered by avatar', () => {
        before('!! deploy and initialize proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
          await setup.data.proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address);
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.pool(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[1].address,
              helpers.values.pool.AMOUNT,
              helpers.values.pool.AMOUNT,
              helpers.values.pool.SLIPPAGE
            ),
            'UniswapProxy: protected operation'
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
            setup.data.proxy.pool(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[0].address,
              helpers.values.pool.AMOUNT,
              helpers.values.pool.AMOUNT,
              helpers.values.pool.SLIPPAGE
            ),
            'UniswapProxy: invalid pair'
          );
        });
      });

      context('» pool amount is invalid', () => {
        before('!! deploy and initialize proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
          await setup.data.proxy.initialize(accounts[0], setup.uniswap.router.address);
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.pool(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, 0, 0, helpers.values.pool.SLIPPAGE),
            'UniswapProxy: invalid amount'
          );
        });
      });

      context('» slippage is invalid', () => {
        before('!! deploy and initialize proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
          await setup.data.proxy.initialize(accounts[0], setup.uniswap.router.address);
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.pool(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[1].address,
              helpers.values.pool.AMOUNT,
              helpers.values.pool.AMOUNT,
              helpers.values.PPM.add(new BN('1'))
            ),
            'UniswapProxy: invalid slippage'
          );
        });
      });
    });

    context('» ERC20 and ERC20', () => {
      context('» pool succeeds', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
        });

        before('!! execute pool', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20s.balanceOf(setup.organization.avatar.address);
          // execute pool
          const { tx, proposal } = await helpers.pool(setup, setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Pool event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Pool', {
            token1: setup.tokens.erc20s[0].address,
            token2: setup.tokens.erc20s[1].address,
            amount1: helpers.values.pool.AMOUNT,
            amount2: helpers.values.pool.AMOUNT,
            min1: helpers.values.pool.MIN,
            min2: helpers.values.pool.MIN,
            pooled1: helpers.values.pool.POOLED1,
            pooled2: helpers.values.pool.POOLED2,
            returned: helpers.values.pool.RETURNED,
          });
        });

        it('it pool tokens', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[0].sub(helpers.values.pool.POOLED1)
          );
          expect(await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[1].sub(helpers.values.pool.POOLED2)
          );
          expect(await setup.uniswap.liquidityTokenERC20s.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[2].add(helpers.values.pool.RETURNED)
          );
        });
      });

      context('» pool fails [slippage exceeds allowed slippage]', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
        });

        before('!! execute pool', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20s.balanceOf(setup.organization.avatar.address);
          // execute failing pool
          const calldata = helpers.encodePool(
            setup.tokens.erc20s[0].address,
            setup.tokens.erc20s[1].address,
            helpers.values.pool.AMOUNT,
            helpers.values.pool.AMOUNT,
            '0' // slippage is zero while pool amounts are the same and pool is unbalanced
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

        it('it emits no Pool event', async () => {
          await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Pool');
        });

        it('it maintains balances', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0]);
          expect(await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1]);
          expect(await setup.uniswap.liquidityTokenERC20s.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[2]);
        });
      });
    });

    context('» ETH and ERC20', () => {
      context('» pool succeeds', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address);
        });

        before('!! execute pool', async () => {
          // store balances
          setup.data.balances[0] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address);
          // execute pool
          const { tx, proposal } = await helpers.pool(setup, constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Pool event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Pool', {
            token1: constants.ZERO_ADDRESS,
            token2: setup.tokens.erc20s[0].address,
            amount1: helpers.values.pool.AMOUNT,
            amount2: helpers.values.pool.AMOUNT,
            min1: helpers.values.pool.MIN,
            min2: helpers.values.pool.MIN,
            pooled1: helpers.values.pool.POOLED1,
            pooled2: helpers.values.pool.POOLED2,
            returned: helpers.values.pool.RETURNED,
          });
        });

        it('it pool tokens', async () => {
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0].sub(helpers.values.pool.POOLED1));
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[1].sub(helpers.values.pool.POOLED2)
          );
          expect(await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[2].add(helpers.values.pool.RETURNED)
          );
        });
      });

      context('» pool fails [slippage exceeds allowed slippage]', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address);
        });

        before('!! execute pool', async () => {
          // store balances
          setup.data.balances[0] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address);
          // execute failing pool
          const calldata = helpers.encodePool(
            constants.ZERO_ADDRESS,
            setup.tokens.erc20s[0].address,
            helpers.values.pool.AMOUNT,
            helpers.values.pool.AMOUNT,
            '0' // slippage is zero while pool amounts are the same and pool is unbalanced
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

        it('it emits no Pool event', async () => {
          await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Pool');
        });

        it('it maintains balances', async () => {
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0]);
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1]);
          expect(await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[2]);
        });
      });
    });

    context('» ERC20 and ETH', () => {
      context('» pool succeeds', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, setup.tokens.erc20s[0].address, constants.ZERO_ADDRESS);
        });

        before('!! execute pool', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address);
          // execute pool
          const { tx, proposal } = await helpers.pool(setup, setup.tokens.erc20s[0].address, constants.ZERO_ADDRESS);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Pool event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Pool', {
            token1: setup.tokens.erc20s[0].address,
            token2: constants.ZERO_ADDRESS,
            amount1: helpers.values.pool.AMOUNT,
            amount2: helpers.values.pool.AMOUNT,
            min1: helpers.values.pool.MIN,
            min2: helpers.values.pool.MIN,
            pooled1: helpers.values.pool.POOLED1,
            pooled2: helpers.values.pool.POOLED2,
            returned: helpers.values.pool.RETURNED,
          });
        });

        it('it pool tokens', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[0].sub(helpers.values.pool.POOLED1)
          );
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1].sub(helpers.values.pool.POOLED2));
          expect(await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[2].add(helpers.values.pool.RETURNED)
          );
        });
      });

      context('» pool fails [slippage exceeds allowed slippage]', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, setup.tokens.erc20s[0].address, constants.ZERO_ADDRESS);
        });

        before('!! execute swap', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address);
          // execute failing pool
          const calldata = helpers.encodePool(
            setup.tokens.erc20s[0].address,
            constants.ZERO_ADDRESS,
            helpers.values.pool.AMOUNT,
            helpers.values.pool.AMOUNT,
            '0' // slippage is zero while pool amounts are the same and pool is unbalanced
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

        it('it emits no Pool event', async () => {
          await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Pool');
        });

        it('it maintains balances', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0]);
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1]);
          expect(await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[2]);
        });
      });
    });
  });

  context('# unpool', () => {
    context('» generics', () => {
      context('» proxy is not initialized', () => {
        before('!! deploy proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.unpool(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[1].address,
              helpers.values.unpool.AMOUNT,
              helpers.values.unpool.EXPECTED1,
              helpers.values.unpool.EXPECTED2
            ),
            'UniswapProxy: not initialized'
          );
        });
      });

      context('» unpool is not triggered by avatar', () => {
        before('!! deploy and initialize proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
          await setup.data.proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address);
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.unpool(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[1].address,
              helpers.values.unpool.AMOUNT,
              helpers.values.unpool.EXPECTED1,
              helpers.values.unpool.EXPECTED2
            ),
            'UniswapProxy: protected operation'
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
            setup.data.proxy.unpool(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[0].address,
              helpers.values.unpool.AMOUNT,
              helpers.values.unpool.EXPECTED1,
              helpers.values.unpool.EXPECTED2
            ),
            'UniswapProxy: invalid pair'
          );
        });
      });

      context('» unpool amount is invalid', () => {
        before('!! deploy and initialize proxy', async () => {
          setup.data.proxy = await UniswapProxy.new();
          await setup.data.proxy.initialize(accounts[0], setup.uniswap.router.address);
        });

        it('it reverts', async () => {
          await expectRevert(
            setup.data.proxy.unpool(
              setup.tokens.erc20s[0].address,
              setup.tokens.erc20s[1].address,
              0,
              helpers.values.unpool.EXPECTED1,
              helpers.values.unpool.EXPECTED2
            ),
            'UniswapProxy: invalid amount'
          );
        });
      });
    });

    context('» ERC20 and ERC20', () => {
      context('» unpool succeeds', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
        });

        before('!! execute pool', async () => {
          await helpers.pool(setup, setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
        });

        before('!! execute unpool', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20s.balanceOf(setup.organization.avatar.address);
          // execute unpool
          const { tx, proposal } = await helpers.unpool(setup, setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Unpool event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Unpool', {
            token1: setup.tokens.erc20s[0].address,
            token2: setup.tokens.erc20s[1].address,
            amount: helpers.values.unpool.AMOUNT,
            expected1: helpers.values.unpool.EXPECTED1,
            expected2: helpers.values.unpool.EXPECTED2,
            returned1: helpers.values.unpool.RETURNED1,
            returned2: helpers.values.unpool.RETURNED2,
          });
        });

        it('it unpool tokens', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[0].add(helpers.values.unpool.RETURNED1)
          );
          expect(await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[1].add(helpers.values.unpool.RETURNED2)
          );
          expect(await setup.uniswap.liquidityTokenERC20s.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[2].sub(helpers.values.unpool.AMOUNT)
          );
        });
      });

      context('» unpool fails [return is less than expected]', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
        });

        before('!! execute pool', async () => {
          await helpers.pool(setup, setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address);
        });

        before('!! execute unpool', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20s.balanceOf(setup.organization.avatar.address);
          // execute failing unpool
          const calldata = helpers.encodeUnpool(
            setup.tokens.erc20s[0].address,
            setup.tokens.erc20s[1].address,
            helpers.values.unpool.AMOUNT,
            helpers.values.unpool.RETURNED1.add(new BN('1')),
            helpers.values.unpool.EXPECTED2
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

        it('it emits no Unpool event', async () => {
          await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Unpool');
        });

        it('it maintains balances', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0]);
          expect(await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1]);
          expect(await setup.uniswap.liquidityTokenERC20s.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[2]);
        });
      });
    });

    context('» ETH and ERC20', () => {
      context('» unpool succeeds', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address);
        });

        before('!! execute pool', async () => {
          await helpers.pool(setup, constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address);
        });

        before('!! execute unpool', async () => {
          // store balances
          setup.data.balances[0] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address);
          // execute unpool
          const { tx, proposal } = await helpers.unpool(setup, constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Unpool event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Unpool', {
            token1: constants.ZERO_ADDRESS,
            token2: setup.tokens.erc20s[0].address,
            amount: helpers.values.unpool.AMOUNT,
            expected1: helpers.values.unpool.EXPECTED1,
            expected2: helpers.values.unpool.EXPECTED2,
            returned1: helpers.values.unpool.RETURNED1,
            returned2: helpers.values.unpool.RETURNED2,
          });
        });

        it('it unpool tokens', async () => {
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0].add(helpers.values.unpool.RETURNED1));
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[1].add(helpers.values.unpool.RETURNED2)
          );
          expect(await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[2].sub(helpers.values.unpool.AMOUNT)
          );
        });
      });

      context('» unpool fails [return is less than expected]', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address);
        });

        before('!! execute pool', async () => {
          await helpers.pool(setup, constants.ZERO_ADDRESS, setup.tokens.erc20s[0].address);
        });

        before('!! execute unpool', async () => {
          // store balances
          setup.data.balances[0] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[1] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address);
          // execute failing unpool
          const calldata = helpers.encodeUnpool(
            constants.ZERO_ADDRESS,
            setup.tokens.erc20s[0].address,
            helpers.values.unpool.AMOUNT,
            helpers.values.unpool.RETURNED1.add(new BN('1')),
            helpers.values.unpool.EXPECTED2
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

        it('it emits no Unpool event', async () => {
          await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Unpool');
        });

        it('it maintains balances', async () => {
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0]);
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1]);
          expect(await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[2]);
        });
      });
    });

    context('» ERC20 and ETH', () => {
      context('» unpool succeeds', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, setup.tokens.erc20s[0].address, constants.ZERO_ADDRESS);
        });

        before('!! execute pool', async () => {
          await helpers.pool(setup, setup.tokens.erc20s[0].address, constants.ZERO_ADDRESS);
        });

        before('!! execute unpool', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address);
          // execute unpool
          const { tx, proposal } = await helpers.unpool(setup, setup.tokens.erc20s[0].address, constants.ZERO_ADDRESS);
          // store data
          setup.data.tx = tx;
          setup.data.proposal = proposal;
        });

        it('it emits a Unpool event', async () => {
          await expectEvent.inTransaction(setup.data.tx.tx, setup.proxy, 'Unpool', {
            token1: setup.tokens.erc20s[0].address,
            token2: constants.ZERO_ADDRESS,
            amount: helpers.values.unpool.AMOUNT,
            expected1: helpers.values.unpool.EXPECTED1,
            expected2: helpers.values.unpool.EXPECTED2,
            returned1: helpers.values.unpool.RETURNED1,
            returned2: helpers.values.unpool.RETURNED2,
          });
        });

        it('it unpool tokens', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[0].add(helpers.values.unpool.RETURNED1)
          );
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1].add(helpers.values.unpool.RETURNED2));
          expect(await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(
            setup.data.balances[2].sub(helpers.values.unpool.AMOUNT)
          );
        });
      });

      context('» unpool fails [return is less than expected]', () => {
        before('!! deploy setup', async () => {
          setup = await deploy(accounts);
        });

        before('!! execute swap [unbalance pool]', async () => {
          await helpers.swap(setup, setup.tokens.erc20s[0].address, constants.ZERO_ADDRESS);
        });

        before('!! execute pool', async () => {
          await helpers.pool(setup, setup.tokens.erc20s[0].address, constants.ZERO_ADDRESS);
        });

        before('!! execute unpool', async () => {
          // store balances
          setup.data.balances[0] = await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address);
          setup.data.balances[1] = await balance.current(setup.organization.avatar.address);
          setup.data.balances[2] = await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address);
          // execute failing unpool
          const calldata = helpers.encodeUnpool(
            setup.tokens.erc20s[0].address,
            constants.ZERO_ADDRESS,
            helpers.values.unpool.AMOUNT,
            helpers.values.unpool.RETURNED1.add(new BN('1')),
            helpers.values.unpool.EXPECTED2
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

        it('it emits no Unpool event', async () => {
          await expectEvent.notEmitted.inTransaction(setup.data.tx.tx, setup.proxy, 'Unpool');
        });

        it('it maintains balances', async () => {
          expect(await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[0]);
          expect(await balance.current(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[1]);
          expect(await setup.uniswap.liquidityTokenERC20ETH.balanceOf(setup.organization.avatar.address)).to.be.bignumber.equal(setup.data.balances[2]);
        });
      });
    });
  });

  context('# upgradeRouter', () => {
    context('» proxy is not initialized', () => {
      before('!! deploy proxy', async () => {
        setup.data.proxy = await UniswapProxy.new();
      });

      it('it reverts', async () => {
        await expectRevert(setup.data.proxy.upgradeRouter(accounts[0]), 'UniswapProxy: not initialized');
      });
    });

    context('» upgradeRouter is not triggered by avatar', () => {
      before('!! deploy and initialize proxy', async () => {
        setup.data.proxy = await UniswapProxy.new();
        await setup.data.proxy.initialize(setup.organization.avatar.address, setup.uniswap.router.address);
      });

      it('it reverts', async () => {
        await expectRevert(setup.data.proxy.upgradeRouter(accounts[0]), 'UniswapProxy: protected operation');
      });
    });

    context('» parameters are invalid', () => {
      before('!! deploy and initialize proxy', async () => {
        setup.data.proxy = await UniswapProxy.new();
        await setup.data.proxy.initialize(accounts[0], setup.uniswap.router.address);
      });

      it('it reverts', async () => {
        await expectRevert(setup.data.proxy.upgradeRouter(constants.ZERO_ADDRESS), 'UniswapProxy: router cannot be null');
      });
    });

    context('» upgrade succeeds', () => {
      before('!! deploy setup', async () => {
        setup = await deploy(accounts);
      });

      before('!! execute upgrade', async () => {
        // execute upgrade
        const { tx, proposal } = await helpers.upgradeRouter(setup, accounts[0]);
        // store data
        setup.data.tx = tx;
        setup.data.proposal = proposal;
        // store data
        setup.data.tx = tx;
        setup.data.proposal = proposal;
      });


      it('it upgrades router', async () => {
        expect(await setup.proxy.router()).to.equal(accounts[0]);
      });
    });
  });
});
