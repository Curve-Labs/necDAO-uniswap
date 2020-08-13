pragma solidity >=0.5.13;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/Controller.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import './uniswap/IUniswapV2Router02.sol';

/**
 * @title A UniswapV2 proxy made with ❤️ for the necDAO folks
 * @dev   We'll tell when we know
 */
contract UniswapProxy {
  bool               public initialized;
  Avatar             public avatar;
  IUniswapV2Router02 public router;

  event Swap (address from, address to, uint256 amount, uint256 expected, uint256 returned);

  modifier isInitialized () {
    require(initialized, "UniswapProxy: proxy not initialized");
    _;
  }

  modifier isNotInitialized () {
    require(!initialized, "UniswapProxy: proxy already initialized");
    _;
  }

  /**
    * @dev           Initialize scheme.
    * @param _avatar The address of the Avatar controlling this scheme.
    * @param _router The address of the Uniswap router through which this scheme will interact with UniswapV2.
    */
  function initialize(Avatar _avatar, IUniswapV2Router02 _router) external isNotInitialized {
      require(_avatar != Avatar(0), "UniswapProxy: avatar cannot be null");

      initialized = true;
      avatar = _avatar;
      router = _router;
  }

  event Test();


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

    // emit Test();
    _swap(_from, _to, _amount, _expected);
  }

  /* internal state-modifying functions */

  function _swap(address _from, address _to, uint256 _amount, uint256 _expected) internal {
    Controller       controller = Controller(avatar.owner());
    address[] memory path = new address[](2);
    bytes     memory returned;
    bool             success;

    if (_from != address(0) && _to != address(0)) {
      path[0] = _from;
      path[1] = _to;
      // swap
      (success, returned) = controller.genericCall(_from, abi.encodeWithSelector(ERC20(_from).approve.selector, address(router), _amount), avatar, 0);
      require(success, 'UniswapProxy: ERC20 approval failed before swap');
      (success, returned) = controller.genericCall(address(router), abi.encodeWithSelector(router.swapExactTokensForTokens.selector, _amount, _expected, path, avatar, block.timestamp), avatar, 0);
      require(success, 'UniswapProxy: swap failed');
    } else if (_from == address(0)) {
      // path[0] = router.WETH();
      // path[1] = _to;
      // returned = router.swapExactETHForTokens.value(_amount)(_expected, path, avatar, block.timestamp)[0];
    } else if (_to == address(0)) {
      // path[0] = _from;
      // path[1] = router.WETH();
      // returned = router.swapExactTokensForETH(_amount, _expected, path, avatar, block.timestamp)[0];
    }

    emit Swap(_from, _to, _amount, _expected, _parseSwapReturnAmount(returned));
  }

  function test() public {
    emit Test();
  }

  function _parseSwapReturnAmount(bytes memory data) internal pure returns (uint256 amount) {
    assembly {
      amount := mload(add(data, 128))
    }
  }
}
