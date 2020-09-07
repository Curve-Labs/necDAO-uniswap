pragma solidity >=0.5.13;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/Controller.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import './interfaces/IUniswapV2Router02.sol';

/**
 * @title A UniswapV2 proxy made with ❤️ for the necDAO folks
 * @dev   Enable necDAO to swap tokens and provide liquidity through UniswapV2 pairs.
 */
contract UniswapProxy {
    using SafeMath for uint256;

    uint256 constant PPM            = 1000000; // 100% = 1000000 | 50% = 500000 | 0% = 0
    string  constant ERROR_PAIR     = "UniswapProxy: invalid pair";
    string  constant ERROR_AMOUNT   = "UniswapProxy: invalid amount";
    string  constant ERROR_APPROVAL = "UniswapProxy: ERC20 approval failed";
    string  constant ERROR_SWAP     = "UniswapProxy: swap failed";
    string  constant ERROR_POOL     = "UniswapProxy: pool failed";

    bool               public   initialized;
    Avatar             public   avatar;
    IUniswapV2Router02 public   router;

    event Swap (address from, address to, uint256 amount, uint256 expected, uint256 returned);
    event Pool (address token1, address token2, uint256 amount1, uint256 amount2, uint256 min1, uint256 min2, uint256 pooled1, uint256 pooled2, uint256 liquidity);

    modifier initializer() {
        require(!initialized, "UniswapProxy: proxy already initialized");
        initialized = true;
        _;
    }

    modifier protected () {
        require(initialized,                   "UniswapProxy: proxy not initialized");
        require(msg.sender == address(avatar), "UniswapProxy: protected operation");
        _;
    }

    /**
      * @dev           Initialize proxy.
      * @param _avatar The address of the Avatar controlling this proxy.
      * @param _router The address of the UniswapV2 router through which this proxy will interact with UniswapV2.
      */
    function initialize(Avatar _avatar, IUniswapV2Router02 _router) external initializer {
        require(_avatar != Avatar(0),             "UniswapProxy: avatar cannot be null");
        require(_router != IUniswapV2Router02(0), "UniswapProxy: router cannot be null");

        avatar = _avatar;
        router = _router;
    }

    /**
      * @dev             Swap tokens.
      * @param _from     The address of the token to swap from [address(0) for ETH].
      * @param _to       The address of the token to swap to [address(0) for ETH].
      * @param _amount   The amount of `_from` token to swap.
      * @param _expected The minimum amount of `_to` token to expect in return for the swap [reverts otherwise].
      */
    function swap(address _from, address _to, uint256 _amount, uint256 _expected) external protected {
        require(_from != _to, ERROR_PAIR);
        require(_amount > 0,  ERROR_AMOUNT);

        _swap(_from, _to, _amount, _expected);
    }

    /**
      * @dev             Pool tokens.
      * @param _token1   The address of the pair's first token to pool [address(0) for ETH].
      * @param _token2   The address of the pair's second token to pool [address(0) for ETH].
      * @param _amount1  The amount of `_token1` to pool.
      * @param _amount2  The amount of `_token2` to pool.
      * @param _slippage The allowed price slippage [reverts otherwise].
      */
    function pool(address _token1, address _token2, uint256 _amount1, uint256 _amount2, uint256 _slippage) external protected {
        require(_token1 != _token2,            ERROR_PAIR);
        require(_amount1 > 0 && _amount2 > 0,  ERROR_AMOUNT);
        require(_slippage <= PPM,              "UniswapProxy: invalid slippage");

        _pool(_token1, _token2, _amount1, _amount2, _slippage);
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
            (success, returned) = controller.genericCall(
                _from,
                abi.encodeWithSelector(IERC20(_from).approve.selector, address(router), _amount),
                avatar,
                0
            );
            require(success, ERROR_APPROVAL);
            (success, returned) = controller.genericCall(
                address(router),
                abi.encodeWithSelector(
                    router.swapExactTokensForTokens.selector,
                    _amount,
                    _expected,
                    path,
                    avatar,
                    block.timestamp
                ),
                avatar,
                0
            );
            require(success, ERROR_SWAP);
        } else if (_from == address(0)) {
            path[0] = router.WETH();
            path[1] = _to;
            (success, returned) = controller.genericCall(
                address(router),
                abi.encodeWithSelector(router.swapExactETHForTokens.selector, _expected, path, avatar, block.timestamp),
                avatar,
                _amount
            );
            require(success, ERROR_SWAP);
        } else if (_to == address(0)) {
            path[0] = _from;
            path[1] = router.WETH();
            (success, returned) = controller.genericCall(
                _from,
                abi.encodeWithSelector(IERC20(_from).approve.selector, address(router), _amount),
                avatar,
                0
            );
            require(success, ERROR_APPROVAL);
            (success, returned) = controller.genericCall(
                address(router),
                abi.encodeWithSelector(
                    router.swapExactTokensForETH.selector,
                    _amount,
                    _expected,
                    path,
                    avatar,
                    block.timestamp
                ),
                avatar,
                0
            );
            require(success, ERROR_SWAP);
        }

        emit Swap(_from, _to, _amount, _expected, _parseSwapReturn(returned));
    }

    function _pool(address _token1, address _token2, uint256 _amount1, uint256 _amount2, uint256 _slippage) internal {
        Controller       controller = Controller(avatar.owner());
        bytes     memory returned;
        bool             success;

        uint256 min1 = _amount1.sub(_amount1.mul(_slippage).div(PPM));
        uint256 min2 = _amount1.sub(_amount2.mul(_slippage).div(PPM));

        if (_token1 != address(0) && _token2 != address(0)) {
            (success, returned) = controller.genericCall(
                _token1,
                abi.encodeWithSelector(IERC20(_token1).approve.selector, address(router), _amount1),
                avatar,
                0
            );
            require(success, ERROR_APPROVAL);
            (success, returned) = controller.genericCall(
                _token2,
                abi.encodeWithSelector(IERC20(_token2).approve.selector, address(router), _amount2),
                avatar,
                0
            );
            require(success, ERROR_APPROVAL);
            (success, returned) = controller.genericCall(
                address(router),
                abi.encodeWithSelector(
                    router.addLiquidity.selector,
                    _token1,
                    _token2,
                    _amount1,
                    _amount2,
                    min1,
                    min2,
                    avatar,
                    block.timestamp
                ),
                avatar,
                0
            );
            require(success, ERROR_POOL);
        } else {
          address token  = _token1 == address(0) ? _token2 : _token1;
          uint256 amount = _token1 == address(0) ? _amount2 : _amount1;
          uint256 value  = _token1 == address(0) ? _amount1 : _amount2;

          (success, returned) = controller.genericCall(
              token,
              abi.encodeWithSelector(IERC20(token).approve.selector, address(router), amount),
              avatar,
              0
          );
          require(success, ERROR_APPROVAL);
          (success, returned) = controller.genericCall(
              address(router),
              abi.encodeWithSelector(
                  router.addLiquidityETH.selector,
                  token,
                  _token2,
                  _amount1,
                  _amount2,
                  min1,
                  min2,
                  avatar,
                  block.timestamp
              ),
              avatar,
              value
          );
          require(success, ERROR_POOL);
        }

        (uint256 pooled1, uint256 pooled2, uint256 liquidity) = _parsePoolReturn(returned);
        emit Pool(_token1, _token2, _amount1, _amount2, min1, min2, pooled1, pooled2, liquidity);
    }

    /* internal helpers */

    function _parseSwapReturn(bytes memory data) internal pure returns (uint256 amount) {
        assembly {
            amount := mload(add(data, 128))
        }
    }

    function _parsePoolReturn(bytes memory data) internal pure returns (uint256 amount1, uint256 amount2, uint256 liquidity) {
        assembly {
            amount1 := mload(add(data, 32))
            amount2 := mload(add(data, 64))
            liquidity := mload(add(data, 96))
        }
    }
}
