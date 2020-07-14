pragma solidity ^0.5.13;

import "@daostack/infra/contracts/votingMachines/ProposalExecuteInterface.sol";
import "@daostack/arc/contracts/votingMachines/VotingMachineCallbacks.sol";


/**
 * @title A UniswapV2 scheme made with ❤️ for the necDAO folks
 * @dev   We'll tell when we know
 */
contract UniswapScheme is VotingMachineCallbacks, ProposalExecuteInterface {

    Avatar           public avatar;
    IntVoteInterface public votingMachine;
    bytes32          public voteParams;

    function initialize(Avatar _avatar, IntVoteInterface _votingMachine, bytes32 _voteParams) external {
        avatar        = _avatar;
        votingMachine = _votingMachine;
        voteParams    = _voteParams;
    }

    function executeProposal(bytes32 _proposalId, int _decision) external returns(bool) {
      return true;
    }
}
