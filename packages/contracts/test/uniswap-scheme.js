import { assert } from 'chai';
import * as helpers from './helpers';
const UniswapProxy = artifacts.require('UniswapProxy');

const encodeSwap = (from, to, amount, expected) => {
  // return web3.eth.abi.encodeFunctionCall(
  //   {
  //     name: 'swap',
  //     type: 'function',
  //     inputs: [
  //       {
  //         type: 'address',
  //         name: '_from',
  //       },
  //       {
  //         type: 'address',
  //         name: '_to',
  //       },
  //       {
  //         type: 'uint256',
  //         name: '_amount',
  //       },
  //       {
  //         type: 'uint256',
  //         name: '_expected',
  //       },
  //     ],
  //   },
  //   [from, to, amount, expected]
  // );

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
    let balances = [];
    it.only('it creates a new Proposal', async () => {
      balances[0] = (await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber();
      balances[1] = (await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber();

      const calldata = encodeSwap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
      console.log(calldata);
      const tx = await setup.scheme.proposeCall(calldata, 0, helpers.NULL_HASH);
      const proposalId = helpers.getValueFromLogs(tx, '_proposalId');

      console.log(tx.receipt.logs[0].args);

      let organizationProposal = await setup.scheme.organizationProposals(proposalId);
      console.log(organizationProposal);

      const tx3 = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });

      console.log(tx3);

      helpers.assertExternalEvent(tx3, 'Swap(address,address,uint256,uint256,uint256)');

      assert.isBelow((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber(), balances[0]);
      assert.isAbove((await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber(), balances[1]);
    });

    it('it creates a new SwapProposal', async () => {
      const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
      const proposalId = helpers.getNewProposalId(tx);
      const proposal = await setup.scheme.swapProposals(proposalId);

      helpers.assertEvent(tx, 'NewSwapProposal');
      assert.equal(await helpers.getValueFromLogs(tx, 'from', 'NewSwapProposal'), setup.tokens.erc20s[0].address);
      assert.equal(await helpers.getValueFromLogs(tx, 'to', 'NewSwapProposal'), setup.tokens.erc20s[1].address);
      assert.equal(await helpers.getValueFromLogs(tx, 'amount', 'NewSwapProposal'), 1000);
      assert.equal(await helpers.getValueFromLogs(tx, 'expected', 'NewSwapProposal'), 500);
      assert.equal(proposal.from, setup.tokens.erc20s[0].address);
      assert.equal(proposal.to, setup.tokens.erc20s[1].address);
      assert.equal(proposal.amount, 1000);
      assert.equal(proposal.expected, 500);
    });
  });

  context('# executeProposal', () => {
    context('> is called by the voting machine', () => {
      context('> proposal exists', () => {
        context('> proposal has not passed yet', () => {
          context('> proposal is accepted', () => {
            it('it updates proposal state to passed', async () => {
              balances[0] = (await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber();
              balances[1] = (await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber();

              const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
              const proposalId = helpers.getNewProposalId(tx);
              await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });
              const proposal = await setup.scheme.proposals(proposalId);

              assert.equal(proposal.passed, true);
            });
          });

          context('> proposal is rejected', () => {
            it('it deletes proposal', async () => {
              const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
              const proposalId = helpers.getNewProposalId(tx);
              const tx2 = await setup.scheme.voting.absoluteVote.vote(proposalId, 2, 0, helpers.NULL_ADDRESS, { from: accounts[0] });

              const proposal = await setup.scheme.proposals(proposalId);
              const swapProposal = await setup.scheme.swapProposals(proposalId);

              helpers.assertExternalEvent(tx2, 'ProposalDeleted(bytes32)');
              assert.equal(proposal.exists, false);
              assert.equal(proposal.passed, false);
              assert.equal(proposal.kind, 0);
              assert.equal(swapProposal.from, 0);
              assert.equal(swapProposal.to, 0);
              assert.equal(swapProposal.amount, 0);
              assert.equal(swapProposal.expected, 0);
            });
          });
        });

        context('> proposal has already passed', () => {
          it('it reverts', () => {
            // cannot test because the voting machine will revert first if `executeProposal` has already been called
          });
        });
      });

      context('> proposal does not exists', () => {
        it('it reverts', () => {
          // cannot test because the voting machine won't allow us to cast a vote on an unknown proposal
        });
      });
    });

    context('> is not called by the voting machine', () => {
      it('it reverts', async () => {
        const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
        const proposalId = helpers.getNewProposalId(tx);

        await helpers.assertRevert(setup.scheme.executeProposal(proposalId, 1), 'only VotingMachine');
      });
    });
  });

  context('# execute', () => {
    let proposalId,
      tx,
      balances = [];

    context(' > ERC20 to ERC20', () => {
      context('> swap is valid', () => {
        before('!! execute swap', async () => {
          balances[0] = (await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber();
          balances[1] = (await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber();

          const _tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
          proposalId = helpers.getNewProposalId(_tx);

          await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });
          tx = await setup.scheme.execute(proposalId);
        });

        it('it executes proposal', async () => {
          helpers.assertEvent(tx, 'ProposalExecuted');
          assert.equal(helpers.getValueFromLogs(tx, 'proposalId', 'ProposalExecuted'), proposalId);
        });

        it('it executes swap', async () => {
          helpers.assertEvent(tx, 'SwapProposalExecuted');
          assert.equal(helpers.getValueFromLogs(tx, 'proposalId', 'SwapProposalExecuted'), proposalId);
          assert.isBelow((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber(), balances[0]);
          assert.isAbove((await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber(), balances[1]);
          assert.equal(
            helpers.getValueFromLogs(tx, 'returned', 'SwapProposalExecuted'),
            (await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toNumber() - balances[1]
          );
        });

        it('it deletes proposal', async () => {
          const proposal = await setup.scheme.proposals(proposalId);
          const swapProposal = await setup.scheme.swapProposals(proposalId);

          helpers.assertEvent(tx, 'ProposalDeleted');
          assert.equal(helpers.getValueFromLogs(tx, 'proposalId', 'ProposalDeleted'), proposalId);
          assert.equal(proposal.exists, false);
          assert.equal(proposal.passed, false);
          assert.equal(proposal.kind, 0);
          assert.equal(swapProposal.from, 0);
          assert.equal(swapProposal.to, 0);
          assert.equal(swapProposal.amount, 0);
          assert.equal(swapProposal.expected, 0);
        });
      });

      context('> swap is invalid', () => {
        it('it reverts', async () => {
          const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '1000');
          proposalId = helpers.getNewProposalId(tx);
          await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });

          await helpers.assertRevert(setup.scheme.execute(proposalId), 'UniswapScheme: swap failed');
        });
      });
    });

    context(' > ETH to ERC20', () => {
      context('> swap is valid', () => {
        before('!! execute swap', async () => {
          balances[0] = Number(await web3.eth.getBalance(setup.organization.avatar.address));
          balances[1] = (await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber();
          const _tx = await setup.scheme.swap(helpers.NULL_ADDRESS, setup.tokens.erc20s[0].address, '1000', '500');
          proposalId = helpers.getNewProposalId(_tx);

          await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });
          tx = await setup.scheme.execute(proposalId);
        });

        it('it executes proposal', async () => {
          helpers.assertEvent(tx, 'ProposalExecuted');
          assert.equal(helpers.getValueFromLogs(tx, 'proposalId', 'ProposalExecuted'), proposalId);
        });

        it('it executes swap', async () => {
          helpers.assertEvent(tx, 'SwapProposalExecuted');
          assert.equal(helpers.getValueFromLogs(tx, 'proposalId', 'SwapProposalExecuted'), proposalId);
          assert.isBelow(Number(await web3.eth.getBalance(setup.organization.avatar.address)), balances[0]);
          assert.isAbove((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber(), balances[1]);
          assert.equal(
            helpers.getValueFromLogs(tx, 'returned', 'SwapProposalExecuted'),
            (await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber() - balances[1]
          );
        });

        it('it deletes proposal', async () => {
          const proposal = await setup.scheme.proposals(proposalId);
          const swapProposal = await setup.scheme.swapProposals(proposalId);

          helpers.assertEvent(tx, 'ProposalDeleted');
          assert.equal(helpers.getValueFromLogs(tx, 'proposalId', 'ProposalDeleted'), proposalId);
          assert.equal(proposal.exists, false);
          assert.equal(proposal.passed, false);
          assert.equal(proposal.kind, 0);
          assert.equal(swapProposal.from, 0);
          assert.equal(swapProposal.to, 0);
          assert.equal(swapProposal.amount, 0);
          assert.equal(swapProposal.expected, 0);
        });
      });

      context('> swap is invalid', () => {
        it('it reverts', async () => {
          const tx = await setup.scheme.swap(helpers.NULL_ADDRESS, setup.tokens.erc20s[0].address, '1000', '1000');
          proposalId = helpers.getNewProposalId(tx);
          await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });

          await helpers.assertRevert(setup.scheme.execute(proposalId), 'UniswapScheme: swap failed');
        });
      });
    });

    context(' > ERC20 to ETH', () => {
      context('> swap is valid', () => {
        before('!! execute swap', async () => {
          balances[0] = (await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber();
          balances[1] = Number(await web3.eth.getBalance(setup.organization.avatar.address));
          const _tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, helpers.NULL_ADDRESS, '1000', '500');
          proposalId = helpers.getNewProposalId(_tx);

          await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });
          tx = await setup.scheme.execute(proposalId);
        });

        it('it executes proposal', async () => {
          helpers.assertEvent(tx, 'ProposalExecuted');
          assert.equal(helpers.getValueFromLogs(tx, 'proposalId', 'ProposalExecuted'), proposalId);
        });

        it('it executes swap', async () => {
          helpers.assertEvent(tx, 'SwapProposalExecuted');
          assert.equal(helpers.getValueFromLogs(tx, 'proposalId', 'SwapProposalExecuted'), proposalId);
          assert.isBelow((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toNumber(), balances[0]);
          assert.isAbove(Number(await web3.eth.getBalance(setup.organization.avatar.address)), balances[1]);
          assert.equal(
            helpers.getValueFromLogs(tx, 'returned', 'SwapProposalExecuted'),
            Number(await web3.eth.getBalance(setup.organization.avatar.address)) - balances[1]
          );
        });

        it('it deletes proposal', async () => {
          const proposal = await setup.scheme.proposals(proposalId);
          const swapProposal = await setup.scheme.swapProposals(proposalId);

          helpers.assertEvent(tx, 'ProposalDeleted');
          assert.equal(helpers.getValueFromLogs(tx, 'proposalId', 'ProposalDeleted'), proposalId);
          assert.equal(proposal.exists, false);
          assert.equal(proposal.passed, false);
          assert.equal(proposal.kind, 0);
          assert.equal(swapProposal.from, 0);
          assert.equal(swapProposal.to, 0);
          assert.equal(swapProposal.amount, 0);
          assert.equal(swapProposal.expected, 0);
        });
      });

      context('> swap is invalid', () => {
        it('it reverts', async () => {
          const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, helpers.NULL_ADDRESS, '1000', '1000');
          proposalId = helpers.getNewProposalId(tx);
          await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });

          await helpers.assertRevert(setup.scheme.execute(proposalId), 'UniswapScheme: swap failed');
        });
      });
    });
  });
});
