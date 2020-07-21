pragma solidity >=0.5.13;

import "@daostack/infra/contracts/votingMachines/ProposalExecuteInterface.sol";
import "@daostack/arc/contracts/votingMachines/VotingMachineCallbacks.sol";
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import './uniswap/UniswapV2Library.sol';
import './uniswap/IUniswapV2Router02.sol';
import "./test/Test.sol";

/**
 * @title A UniswapV2 scheme made with ❤️ for the necDAO folks
 * @dev   We'll tell when we know
 */
contract UniswapScheme is VotingMachineCallbacks, ProposalExecuteInterface {
    enum ProposalKind { Swap, Seed }

    struct Proposal {
      bool         exists;
      bool         passed;
      ProposalKind kind;
    }

    Avatar                       public avatar;
    IntVoteInterface             public votingMachine;
    bytes32                      public voteParams;
    address                      public factory;
    mapping(bytes32 => Proposal) public proposals;

    event NewProposal                    (bytes32 indexed proposalId, ProposalKind kind);
    event ProposalExecutedByVotingMachine(bytes32 indexed proposalId, int256 decision);
    event ProposalExecuted               (bytes32 indexed proposalId, bytes returnvalue);
    event ProposalDeleted                (bytes32 indexed proposalId);
    event NewSwapProposal                (bytes32 indexed proposalId, address from, address to, uint256 amount, uint256 expected);

    // make sure it reverts on reinitialziation
    function initialize(Avatar _avatar, IntVoteInterface _votingMachine, bytes32 _voteParams, address _factory) external {
        avatar        = _avatar;
        votingMachine = _votingMachine;
        voteParams    = _voteParams;
        factory       = _factory;
    }

    /**
     * @dev             Submit a proposal to swap tokens.
     * @param _from     The address of the token to swap from [address(0) for ETH].
     * @param _to       The address of the token to swap to [address(0) for ETH].
     * @param _amount   The amount of `_from` token to swap.
     * @param _expected The minimum amount of `_to` token to expect in return for the swap [reverts otherwise]
     */
    function swap(address _from, address _to, uint256 _amount, uint256 _expected) public returns (bytes32) {
      bytes32 proposalId = votingMachine.propose(2, voteParams, msg.sender, address(avatar));

      proposals[proposalId] = Proposal({exists: true, passed: false, kind: ProposalKind.Swap });
      proposalsInfo[address(votingMachine)][proposalId] = ProposalInfo({ blockNumber: block.number, avatar: avatar });

      emit NewSwapProposal(proposalId, _from, _to, _amount, _expected);

      return proposalId;
    }

    event Pair(address pair);

    function test(address _from, address _to) external {
      IUniswapV2Pair pair = IUniswapV2Pair(UniswapV2Library.pairFor(factory, _from, _to));

      emit Pair(address(pair));
    }

    /**
     * @dev               Update the state of the proposal depending on wether it has ben accepted or rejected by the voting machine. Can only be called by the voting machine in which the vote is held.
     * @param _proposalId The id of the proposal in the voting machine.
     * @param _decision   The voting result. 1 for 'yes' and 2 for 'no'.
     * @return            True [reverts otherwise].
     */
    function executeProposal(bytes32 _proposalId, int256 _decision) external onlyVotingMachine(_proposalId) returns (bool) {
      Proposal storage proposal = proposals[_proposalId];
      require(proposal.exists,  "must be a live proposal");
      require(!proposal.passed, "cannot execute twice");

      emit ProposalExecutedByVotingMachine(_proposalId, _decision);

      if (_decision == 1) {
          proposal.passed = true;
      } else {
          delete proposals[_proposalId];
          emit ProposalDeleted(_proposalId);
      }

      return true;
    }

    /**
     * @dev              Execute the proposal if has been accepter by the voting machine and is still pending [reverts otherwise].
     * @param _proposalId The id of the proposal in the voting machine.
     */
    function execute(bytes32 _proposalId) public {
      // to be used later to store return values of `genericCall`
      bytes memory returnValue;
      bool success;
      // fetch proposal
      Proposal storage proposal = proposals[_proposalId];
      // check whether proposal can be executed or nor
      require(proposal.exists, "must be a live proposal");
      require(proposal.passed, "proposal must be passed by voting machine");
      // update states upfront to circumvent reentrancy attacks
      proposal.exists = false;
      // execute transaction on behalf of `avatar`
      Controller controller = Controller(avatar.owner());
      // (success, returnValue) = controller.genericCall(proposal.test, abi.encodeWithSelector(TestTarget(proposal.test).update.selector, proposal.description), avatar, 0);
      // update state according to the success of the transaction
      if (success) {
          // delete proposal in case of success
          delete proposals[_proposalId];
          emit ProposalDeleted(_proposalId);
          emit ProposalExecuted(_proposalId, returnValue);
      } else {
          // restore state in case of failure
          proposal.exists = true;
      }
    }

    function _swap(address _from, address _to, uint256 _amount, uint256 _expected) internal {

    }
}
