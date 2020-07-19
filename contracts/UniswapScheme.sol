pragma solidity ^0.5.13;

import "@daostack/infra/contracts/votingMachines/ProposalExecuteInterface.sol";
import "@daostack/arc/contracts/votingMachines/VotingMachineCallbacks.sol";


/**
 * @title A UniswapV2 scheme made with ❤️ for the necDAO folks
 * @dev   We'll tell when we know
 */
contract UniswapScheme is VotingMachineCallbacks, ProposalExecuteInterface {

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
}
