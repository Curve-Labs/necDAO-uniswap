const TestTarget = artifacts.require('TestTarget');
import * as helpers from './helpers';
import { assert } from 'chai';

const ProposalKind = { Swap: 0, Seed: 1 };

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
  // deploy uniswap scheme
  setup.scheme = await helpers.setup.scheme(setup);
  // deploy test target contract
  setup.target = await TestTarget.new();
  return setup;
};

contract('UniswapScheme', (accounts) => {
  let setup;
  before('!! deploy setup', async () => {
    setup = await deploy(accounts);
  });

  context('# initialize', () => {
    it('it initializes scheme', async () => {
      assert.equal(await setup.scheme.avatar(), setup.organization.avatar.address);
      assert.equal(await setup.scheme.votingMachine(), setup.scheme.voting.absoluteVote.address);
      assert.equal(await setup.scheme.voteParams(), setup.scheme.voting.params);
      assert.equal(await setup.scheme.router(), setup.uniswap.router.address);
    });

    it('it reverts on re-initialization', async () => {
      // await scheme.initialize(setup.organization.avatar.address, scheme.voting.absoluteVote.address, scheme.voting.params, setup.uniswap.router.address);
    });
  });

  context('# swap', () => {
    it('it emits a NewProposal event', async () => {
      const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');

      helpers.assertEvent(tx, 'NewProposal');
      assert.equal(await helpers.getValueFromLogs(tx, 'kind', 'NewProposal'), ProposalKind.Swap);
    });

    it('it emits a NewSwapProposal event', async () => {
      const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');

      helpers.assertEvent(tx, 'NewSwapProposal');
      assert.equal(await helpers.getValueFromLogs(tx, 'from', 'NewSwapProposal'), setup.tokens.erc20s[0].address);
      assert.equal(await helpers.getValueFromLogs(tx, 'to', 'NewSwapProposal'), setup.tokens.erc20s[1].address);
      assert.equal(await helpers.getValueFromLogs(tx, 'amount', 'NewSwapProposal'), 1000);
      assert.equal(await helpers.getValueFromLogs(tx, 'expected', 'NewSwapProposal'), 500);
    });

    it('it registers Proposal', async () => {
      const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
      const proposalId = helpers.getNewProposalId(tx);
      const proposal = await setup.scheme.proposals(proposalId);

      assert.equal(proposal.exists, true);
      assert.equal(proposal.passed, false);
      assert.equal(proposal.kind, ProposalKind.Swap);
    });

    it('it registers SwapProposal', async () => {
      const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
      const proposalId = helpers.getNewProposalId(tx);
      const proposal = await setup.scheme.swapProposals(proposalId);

      assert.equal(proposal.from, setup.tokens.erc20s[0].address);
      assert.equal(proposal.to, setup.tokens.erc20s[1].address);
      assert.equal(proposal.amount, 1000);
      assert.equal(proposal.expected, 500);
    });

    context('>> executeProposal', () => {});

    context('>> execute', () => {
      context(' >> ERC20 to ERC20', () => {
        let proposalId, tx;
        before('!! execute swap', async () => {
          const _tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
          proposalId = helpers.getNewProposalId(_tx);
          await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });
          tx = await setup.scheme.execute(proposalId);
        });

        it('it executes swap', async () => {
          console.log((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toString());
          console.log((await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toString());

          const tx = await setup.scheme.swap(setup.tokens.erc20s[0].address, setup.tokens.erc20s[1].address, '1000', '500');
          const proposalId = helpers.getNewProposalId(tx);
          const tx2 = await setup.scheme.voting.absoluteVote.vote(proposalId, 1, 0, helpers.NULL_ADDRESS, { from: accounts[0] });
          const tx3 = await setup.scheme.execute(proposalId);

          helpers.assertEvent(tx3, 'ProposalExecuted');
          helpers.assertEvent(tx3, 'ProposalDeleted');
          helpers.assertEvent(tx3, 'SwapProposalExecuted');
          console.log((await helpers.getValueFromLogs(tx3, 'returned', 'SwapProposalExecuted')).toString());

          // helpers.assertExternalEvent(tx3, 'Approval(address,address,uint256)');

          console.log((await setup.tokens.erc20s[0].balanceOf(setup.organization.avatar.address)).toString());
          console.log((await setup.tokens.erc20s[1].balanceOf(setup.organization.avatar.address)).toString());
        });

        it('it emits a ProposalExecuted event', async () => {});

        it('it deletes the Proposal', async () => {
          const proposal = await setup.scheme.proposals(proposalId);
          const swapProposal = await setup.scheme.swapProposals(proposalId);

          helpers.assertEvent(tx, 'ProposalDeleted');
          assert.equal(proposal.exists, false);
          assert.equal(proposal.exists, false);
          assert.equal(proposal.kind, 0);
          assert.equal(swapProposal.from, 0);
          assert.equal(swapProposal.to, 0);
          assert.equal(swapProposal.amount, 0);
          assert.equal(swapProposal.expected, 0);
        });
      });
    });
  });
});
