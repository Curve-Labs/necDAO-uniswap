pragma solidity >=0.5.13;

import "@daostack/infra/contracts/votingMachines/ProposalExecuteInterface.sol";
import "@daostack/arc/contracts/votingMachines/VotingMachineCallbacks.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import './uniswap/IUniswapV2Router02.sol';

/**
 * @title A UniswapV2 scheme made with ❤️ for the necDAO folks
 * @dev   We'll tell when we know
 */
contract UniswapScheme {
  bool               public initialized;
  Avatar             public avatar;
  IUniswapV2Router02 public router;

  // swap events
  event Swap (address from, address to, uint256 amount, uint256 expected, uint256 returned);
  // seed events
  // TODO

  modifier isInitialized () {
    require(initialized, "UniswapScheme: scheme not initialized");
    _;
  }

  modifier isNotInitialized () {
    require(!initialized, "UniswapScheme: scheme already initialized");
    _;
  }

  /**
    * @dev           Initialize scheme.
    * @param _avatar The address of the Avatar controlling this scheme.
    * @param _router The address of the Uniswap router through which this scheme will interact with UniswapV2.
    */
  function initialize(Avatar _avatar, IUniswapV2Router02 _router) external isNotInitialized {
      require(_avatar != Avatar(0), "UniswapScheme: avatar cannot be null");

      initialized = true;
      avatar = _avatar;
      router = _router;
  }

  /**
    * @dev             Submit a proposal to swap tokens.
    * @param _from     The address of the token to swap from [address(0) for ETH].
    * @param _to       The address of the token to swap to [address(0) for ETH].
    * @param _amount   The amount of `_from` token to swap.
    * @param _expected The minimum amount of `_to` token to expect in return for the swap [reverts otherwise]
    */
  function swap(address _from, address _to, uint256 _amount, uint256 _expected) public isInitialized {
    require(_amount > 0,  "UniswapScheme: invalid swap amount");
    require(_from != _to, "UniswapScheme: invalid swap pair");

    _swap(_from, _to, _amount, _expected);
  }

  /* internal state-modifying functions */

  function _swap(address _from, address _to, uint256 _amount, uint256 _expected) internal {
    address[] memory path = new address[](2);
    uint256 returned;

    if (_from != address(0) && _to != address(0)) {
      path[0] = _from;
      path[1] = _to;
      returned = router.swapExactTokensForTokens(_amount, _expected, path, avatar, block.timestamp);
    } else if (_from == address(0)) {
      path[0] = router.WETH();
      path[1] = _to;
      returned = router.swapExactETHForTokens.value(_amount)(_expected, path, avatar, block.timestamp);
    } else if (_to == address(0)) {
      path[0] = _from;
      path[1] = router.WETH();
      returned = router.swapExactTokensForETH(_amount, _expected, path, avatar, block.timestamp);
    }
    emit Swap(_from, _to, _amount, _expected, returned);
  }
}
