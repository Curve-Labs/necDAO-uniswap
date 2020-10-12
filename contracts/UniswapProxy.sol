pragma solidity >=0.5.13;

import "@daostack/arc/contracts/controller/Avatar.sol";
import "@daostack/arc/contracts/controller/Controller.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import './interfaces/IUniswapV2Factory.sol';
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
    string  constant ERROR_UNPOOL   = "UniswapProxy: unpool failed";

    bool               public   initialized;
    Avatar             public   avatar;
    IUniswapV2Router02 public   router;

    event Swap (address indexed from, address indexed to, uint256 amount, uint256 expected, uint256 returned);
    event Pool (
        address indexed token1,
        address indexed token2,
        uint256 amount1,
        uint256 amount2,
        uint256 min1,
        uint256 min2,
        uint256 pooled1,
        uint256 pooled2,
        uint256 returned
    );
    event Unpool (
        address indexed token1,
        address indexed token2,
        uint256 amount,
        uint256 expected1,
        uint256 expected2,
        uint256 returned1,
        uint256 returned2
    );

    modifier initializer() {
        require(!initialized, "UniswapProxy: already initialized");
        initialized = true;
        _;
    }

    modifier protected () {
        require(initialized,                   "UniswapProxy: not initialized");
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
      * @param _token1   The address of the pair's first token [address(0) for ETH].
      * @param _token2   The address of the pair's second token [address(0) for ETH].
      * @param _amount1  The amount of `_token1` to pool.
      * @param _amount2  The amount of `_token2` to pool.
      * @param _slippage The allowed price slippage [reverts otherwise].
      */
    function pool(
        address _token1,
        address _token2,
        uint256 _amount1,
        uint256 _amount2,
        uint256 _slippage
    ) external protected {
        require(_token1 != _token2,            ERROR_PAIR);
        require(_amount1 > 0 && _amount2 > 0,  ERROR_AMOUNT);
        require(_slippage <= PPM,              "UniswapProxy: invalid slippage");

        _pool(_token1, _token2, _amount1, _amount2, _slippage);
    }

    /**
      * @dev              Unpool tokens.
      * @param _token1    The address of the pair's first token [address(0) for ETH].
      * @param _token2    The address of the pair's second token [address(0) for ETH].
      * @param _amount    The amount of liquidity token to unpool.
      * @param _expected1 The minimum amount of `_token1` to expect in return for this transaction [reverts otherwise].
      * @param _expected2 The minimum amount of `_token2` to expect in return for this transaction [reverts otherwise].
      */
    function unpool(
        address _token1,
        address _token2,
        uint256 _amount,
        uint256 _expected1,
        uint256 _expected2
    ) external protected {
        require(_token1 != _token2, ERROR_PAIR);
        require(_amount > 0,        ERROR_AMOUNT);

        _unpool(_token1, _token2, _amount, _expected1, _expected2);
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
            _approve(_from, _amount);
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
            _approve(_from, _amount);
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
        uint256 min2 = _amount2.sub(_amount2.mul(_slippage).div(PPM));

        if (_token1 != address(0) && _token2 != address(0)) {
            _approve(_token1, _amount1);
            _approve(_token2, _amount2);
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
            address token    = _token1 == address(0) ? _token2 : _token1;
            uint256 amount   = _token1 == address(0) ? _amount2 : _amount1;
            uint256 value    = _token1 == address(0) ? _amount1 : _amount2;
            uint256 minToken = _token1 == address(0) ? min2 : min1;
            uint256 minETH   = _token1 == address(0) ? min1 : min2;
            _approve(token, amount);
            (success, returned) = controller.genericCall(
                address(router),
                abi.encodeWithSelector(
                    router.addLiquidityETH.selector,
                    token,
                    amount,
                    minToken,
                    minETH,
                    avatar,
                    block.timestamp
                ),
                avatar,
                value
            );
            require(success, ERROR_POOL);
        }
        
        (uint256 pooled1, uint256 pooled2, uint256 _returned) = _parsePoolReturn(_token1, returned);
        emit Pool(_token1, _token2, _amount1, _amount2, min1, min2, pooled1, pooled2, _returned);
    }

    function _unpool(address _token1, address _token2, uint256 _amount, uint256 _expected1, uint256 _expected2) internal {
        address          pair       = _pair(_token1, _token2);
        Controller       controller = Controller(avatar.owner());
        bytes     memory returned;
        bool             success;

        _approve(pair, _amount);

        if (_token1 != address(0) && _token2 != address(0)) {
            (success, returned) = controller.genericCall(
                address(router),
                abi.encodeWithSelector(
                    router.removeLiquidity.selector,
                    _token1,
                    _token2,
                    _amount,
                    _expected1,
                    _expected2,
                    avatar,
                    block.timestamp
                ),
                avatar,
                0
            );
            require(success, ERROR_UNPOOL);
        } else {
            address token         = _token1 == address(0) ? _token2 : _token1;
            uint256 expectedToken = _token1 == address(0) ? _expected2 : _expected1;
            uint256 expectedETH   = _token1 == address(0) ? _expected1 : _expected2;
            (success, returned) = controller.genericCall(
                address(router),
                abi.encodeWithSelector(
                    router.removeLiquidityETH.selector,
                    token,
                    _amount,
                    expectedToken,
                    expectedETH,
                    avatar,
                    block.timestamp
                ),
                avatar,
                0
            );
            require(success, ERROR_UNPOOL);
        }
        
        (uint256 returned1, uint256 returned2) = _parseUnpoolReturn(_token1, returned);
        emit Unpool(_token1, _token2, _amount, _expected1, _expected2, returned1, returned2);
    }

    /* internal helpers functions */

    function _approve(address _token, uint256 _amount) internal {
        Controller       controller = Controller(avatar.owner());
        bool             success;

        if (IERC20(_token).allowance(address(avatar), address(router)) > 0) {
            // reset allowance to make sure final approval does not revert
            (success,) = controller.genericCall(
                _token,
                abi.encodeWithSelector(IERC20(_token).approve.selector, address(router), 0),
                avatar,
                0
            );
            require(success, ERROR_APPROVAL);
        }
        (success,) = controller.genericCall(
            _token,
            abi.encodeWithSelector(IERC20(_token).approve.selector, address(router), _amount),
            avatar,
            0
        );
        require(success, ERROR_APPROVAL);
    }

    function _pair(address _token1, address _token2) internal view returns (address) {
        address token1 = _token1 == address(0) ? router.WETH() : _token1;
        address token2 = _token2 == address(0) ? router.WETH() : _token2;

        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        address           pair    = factory.getPair(token1, token2);

        require(pair != address(0), ERROR_PAIR);
        return pair;
    }

    function _parseSwapReturn(bytes memory data) internal pure returns (uint256 amount) {
        assembly {
            amount := mload(add(data, 128))
        }
    }

    function _parsePoolReturn(
        address _token1,
        bytes memory data
    ) internal pure returns (uint256 pooled1, uint256 pooled2, uint256 returned) {
        if (_token1 == address(0)) {
            assembly {
                pooled2 := mload(add(data, 32))
                pooled1 := mload(add(data, 64))
                returned := mload(add(data, 96))
            }
        } else {
            assembly {
                pooled1 := mload(add(data, 32))
                pooled2 := mload(add(data, 64))
                returned := mload(add(data, 96))
            }            
        }
    }

    function _parseUnpoolReturn(
        address _token1,
        bytes memory data
    ) internal pure returns (uint256 returned1, uint256 returned2) {
        if (_token1 == address(0)) {
            assembly {
                returned1 := mload(add(data, 64))
                returned2 := mload(add(data, 32))
            }
        } else {
            assembly {
                returned1 := mload(add(data, 32))
                returned2 := mload(add(data, 64))
            }
        }
    }
}
