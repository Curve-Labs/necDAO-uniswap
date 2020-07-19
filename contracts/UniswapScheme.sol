pragma solidity ^0.5.13;

import "@daostack/infra/contracts/votingMachines/ProposalExecuteInterface.sol";
import "@daostack/arc/contracts/votingMachines/VotingMachineCallbacks.sol";
import "./test/Test.sol";

/**
 * @title A UniswapV2 scheme made with ❤️ for the necDAO folks
 * @dev   We'll tell when we know
 */
contract UniswapScheme is VotingMachineCallbacks, ProposalExecuteInterface {
    // enum ProposalType { UniswapSwap, UniswapSeed }

    struct Proposal {
      address test;
      string  description;
    }

    Avatar                       public avatar;
    IntVoteInterface             public votingMachine;
    bytes32                      public voteParams;
    mapping(bytes32 => Proposal) public proposals;

    event SwapETHForTokenProposal(bytes32 indexed proposalId);
    event Decision(bytes32 proposalId, int decision);

    function initialize(Avatar _avatar, IntVoteInterface _votingMachine, bytes32 _voteParams) external {
        avatar        = _avatar;
        votingMachine = _votingMachine;
        voteParams    = _voteParams;
    }


    /**
     * @dev    Submit a proposal to swap ETH for token
     * @param _description A hash of the proposal's description
    */
    function swapETHForToken (
      address        _test,
      string  memory _description
    )
    public
    returns (bytes32 proposalId) {
      proposalId = votingMachine.propose(2, voteParams, msg.sender, address(avatar));
      proposals[proposalId] = Proposal({test: _test, description: _description });

      proposalsInfo[address(votingMachine)][proposalId] = ProposalInfo({
        blockNumber:block.number,
        avatar:avatar
      });

      emit SwapETHForTokenProposal(proposalId);
    }

    function executeProposal(bytes32 _proposalId, int _decision) external onlyVotingMachine(_proposalId) returns(bool) {
      emit Decision(_proposalId, _decision);
      return true;
    }

    function execute(bytes32 _proposalId) public {
      Proposal storage proposal = proposals[_proposalId];
      // require(proposal.exist, "must be a live proposal");
      // require(proposal.passed, "proposal must passed by voting machine");
      // proposal.exist = false;
      bytes memory genericCallReturnValue;
      bool success;
      Controller controller = Controller(avatar.owner());
      (success, genericCallReturnValue) = controller.genericCall(proposal.test, abi.encodeWithSelector(TestTarget(proposal.test).update.selector, proposal.description), avatar, 0);
      // controller.genericCall(proposal.test, proposal.callData, proposal.value);
      
      // if (success) {
      //     delete organizationProposals[_proposalId];
      //     emit ProposalDeleted(address(avatar), _proposalId);
      //     emit ProposalExecuted(address(avatar), _proposalId, genericCallReturnValue);
      // } else {
      //     proposal.exist = true;
      // }
    }
}
