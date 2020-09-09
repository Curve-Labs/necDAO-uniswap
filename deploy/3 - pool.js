const ERC20 = artifacts.require('ERC20Mock');
const UniswapRouter = artifacts.require('UniswapV2Router');

const { BN } = require('@openzeppelin/test-helpers');
const ONE_ETH = new BN('1000000000000000000');
const ONE_DAI = new BN('1000000000000000000');

const getTimestamp = async () => {
  return (await web3.eth.getBlock('latest')).timestamp;
};

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const poolERC20s = async (amount1, amount2) => {
    const router = await UniswapRouter.at('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
    const DAI = await ERC20.at((await get('DAI')).address);
    const USDC = await ERC20.at((await get('USDC')).address);

    await DAI.approve(router.address, amount1);
    await USDC.approve(router.address, amount2);
    await router.addLiquidity(DAI.address, USDC.address, amount1, amount2, amount1, amount2, deployer, (await getTimestamp()) + 10000000);
    log('+ Added liquidity for DAI / USDC pair');
  };

  const poolETHERC20 = async (amountETH, amountERC20) => {
    const router = await UniswapRouter.at('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
    const DAI = await ERC20.at((await get('DAI')).address);

    await DAI.approve(router.address, amountERC20);
    await router.addLiquidityETH(DAI.address, amountERC20, amountERC20, amountETH, deployer, (await getTimestamp()) + 10000000, { value: amountETH });
    log('+ Added liquidity for ETH / DAI pair');
  };

  if ((await getChainId()) == '4') {
    // await poolERC20s(CASH_AMOUNT, CASH_AMOUNT);
    await poolETHERC20(ONE_ETH.mul(new BN('5')), ONE_DAI.mul(new BN('300')).mul(new BN('5')));
  } else {
    log('+ Unknown network. Skipped pooling pairs.');
  }
};

module.exports.tags = ['pool'];
