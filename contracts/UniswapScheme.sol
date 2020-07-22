pragma solidity >=0.5.13;

import "@daostack/infra/contracts/votingMachines/ProposalExecuteInterface.sol";
import "@daostack/arc/contracts/votingMachines/VotingMachineCallbacks.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import './uniswap/IUniswapV2Router02.sol';

/**
 * @title A UniswapV2 scheme made with ❤️ for the necDAO folks
 * @dev   We'll tell when we know
 */
contract UniswapScheme is VotingMachineCallbacks, ProposalExecuteInterface {
    // use safeERC20 ? does it work when used through generic call ?
    enum ProposalKind { Swap, Seed }

    struct Proposal {
      bool         exists;
      bool         passed;
      ProposalKind kind;
    }

    struct SwapProposal {
      address from;
      address to;
      uint256 amount;
      uint256 expected;
    }

    struct SeedProposal {
      address token1;
      address token2;
    }

    Avatar                           public avatar;
    IntVoteInterface                 public votingMachine;
    bytes32                          public voteParams;
    IUniswapV2Router02               public router;
    mapping(bytes32 => Proposal)     public proposals;
    mapping(bytes32 => SwapProposal) public swapProposals;
    mapping(bytes32 => SeedProposal) public seedProposals;

    // generic events
    event NewProposal                    (bytes32 indexed proposalId, ProposalKind kind);
    event ProposalExecutedByVotingMachine(bytes32 indexed proposalId, int256 decision);
    event ProposalExecuted               (bytes32 indexed proposalId);
    event ProposalDeleted                (bytes32 indexed proposalId);
    // swap events
    event NewSwapProposal                (bytes32 indexed proposalId, address from, address to, uint256 amount, uint256 expected);
    event SwapProposalExecuted           (bytes32 indexed proposalId, address from, address to, uint256 amount, uint256 expected, uint256 returned);
    // seed events
    // TODO

    /**
     * @dev                  Initialize scheme.
     * @param _avatar        The address of the Avatar on behalf of which this scheme interacts with UniswapV2.
     * @param _votingMachine The address of the voting machine controlling this scheme.
     * @param _voteParams    The parameters of the voting machine controlling this scheme.
     * @param _router        The address of the Uniswap router through which this scheme will interact with UniswapV2.
     */
    function initialize(Avatar _avatar, IntVoteInterface _votingMachine, bytes32 _voteParams, IUniswapV2Router02 _router) external {
        require(avatar == Avatar(0),  "UniswapScheme: scheme already initialized");
        require(_avatar != Avatar(0), "UniswapScheme: avatar cannot be null");

        avatar = _avatar;
        votingMachine = _votingMachine;
        voteParams = _voteParams;
        router = _router;
    }

    /**
     * @dev             Submit a proposal to swap tokens.
     * @param _from     The address of the token to swap from [address(0) for ETH].
     * @param _to       The address of the token to swap to [address(0) for ETH].
     * @param _amount   The amount of `_from` token to swap.
     * @param _expected The minimum amount of `_to` token to expect in return for the swap [reverts otherwise]
     */
    function swap(address _from, address _to, uint256 _amount, uint256 _expected) public returns (bytes32) {
      require(_amount > 0, "UniswapScheme: invalid swap amount");

      bytes32 proposalId = votingMachine.propose(2, voteParams, msg.sender, address(avatar));

      proposals[proposalId] = Proposal({ exists: true, passed: false, kind: ProposalKind.Swap });
      swapProposals[proposalId] = SwapProposal({ from: _from, to: _to, amount: _amount, expected: _expected });
      proposalsInfo[address(votingMachine)][proposalId] = ProposalInfo({ blockNumber: block.number, avatar: avatar });

      emit NewProposal(proposalId, ProposalKind.Swap);
      emit NewSwapProposal(proposalId, _from, _to, _amount, _expected);

      return proposalId;
    }

    /**
     * @dev               Update the state of the proposal depending on wether it has been accepted or rejected by the voting machine. Can only be called by the voting machine in which the vote is held.
     * @param _proposalId The id of the proposal in the voting machine.
     * @param _decision   The voting result. 1 for 'yes' and 2 for 'no'.
     * @return            True [reverts otherwise].
     */
    function executeProposal(bytes32 _proposalId, int256 _decision) external onlyVotingMachine(_proposalId) returns (bool) {
      Proposal storage proposal = proposals[_proposalId];
      require(proposal.exists,  "UniswapScheme: proposal does not exist");
      require(!proposal.passed, "UniswapScheme: proposal already passed");

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
     * @dev               Execute the proposal if it has been accepted by the voting machine and is still pending [reverts otherwise].
     * @param _proposalId The id of the proposal in the voting machine.
     */
    function execute(bytes32 _proposalId) public {
      // fetch proposal
      Proposal storage proposal = proposals[_proposalId];
      // check whether proposal can be executed or not
      require(proposal.exists, "UniswapScheme: proposal does not exist");
      require(proposal.passed, "UniswapScheme: proposal is not passed yet");
      // update states upfront to circumvent reentrancy attacks // _swap or _seed functions reverts in case of failure anyhow
      proposal.exists = false;

      if (proposal.kind == ProposalKind.Swap) {
        _swap(_proposalId);
        // delete proposal in case of success // _swap reverts otherwise
        delete proposals[_proposalId];
        delete swapProposals[_proposalId];
        // emit relevant events
        emit ProposalExecuted(_proposalId);
        emit ProposalDeleted(_proposalId);
      }
    }

    event Test2(bytes data);

    function _swap(bytes32 _proposalId) internal {
      SwapProposal storage proposal = swapProposals[_proposalId];
      uint256 returned;

      if (proposal.from != address(0) && proposal.to != address(0)) {
        returned = _swapERC20s(proposal);
      }
      emit SwapProposalExecuted(_proposalId, proposal.from, proposal.to, proposal.amount, proposal.expected, returned);
    }

    function _swapERC20s(SwapProposal storage _proposal) internal returns (uint256) {
      Controller controller = Controller(avatar.owner());
      // to be used later to store return values of `genericCall`
      bytes memory returned;
      bool success;
      // prepare parameters
      address[] memory path = new address[](2);
      path[0] = _proposal.from;
      path[1] = _proposal.to;
      // approve ERC20 `transferFrom`
      (success, returned) = controller.genericCall(_proposal.from, abi.encodeWithSelector(ERC20(_proposal.from).approve.selector, address(router), _proposal.amount), avatar, 0);
      require(success, 'UniswapScheme: ERC20 approval failed before swap');
      // swap
      (success, returned) = controller.genericCall(address(router), abi.encodeWithSelector(router.swapExactTokensForTokens.selector, _proposal.amount, _proposal.expected, path, avatar, block.timestamp), avatar, 0);
      require(success, 'UniswapScheme: swap failed');

      return parseSwapReturnAmount(returned);
    }

    // function _swapFromETH() internal returns (uint256) {

    // }

    // function _swapToETH() internal returns (uint256) {

    // }

    function parseSwapReturnAmount(bytes memory data) public pure returns (uint256 amount) {
      assembly {
        amount := mload(add(data, 128))
      }
    }
}
