const ERC20 = artifacts.require('ERC20Mock');
const UniswapFactory = artifacts.require('UniswapV2Factory');
const UniswapRouter = artifacts.require('UniswapV2Router');

const ONE_ETH = '1000000000000000000';
const CASH_AMOUNT = '1000000000000000000000';

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  if ((await getChainId()) == '4') {
    // initialize contracts artifacts
    const factory = await UniswapFactory.at('0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f');
    const router = await UniswapRouter.at('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
    // deploy DAI
    const dai = await deploy('DAI', {
      contract: 'ERC20Mock',
      from: deployer,
      args: ['DAI Stablecoin', 'DAI', 18],
    });
    log('+ Deployed DAI at ' + dai.address);
    // deploy USDC
    const usdc = await deploy('USDC', {
      contract: 'ERC20Mock',
      from: deployer,
      args: ['USDC Stablecoin', 'USDC', 18],
    });
    log('+ Deployed USDC at ' + usdc.address);
    // create pairs
    const tx1 = await factory.createPair(dai.address, usdc.address);
    log('+ Created uniswap pair for DAI / USDC at ' + tx1.logs[0].args.pair);
    // seed liquidity
    const DAI = await ERC20.at(dai.address);
    const USDC = await ERC20.at(usdc.address);
    await DAI.approve(router.address, CASH_AMOUNT);
    await USDC.approve(router.address, CASH_AMOUNT);
    const timestamp = (await web3.eth.getBlock('latest')).timestamp;
    await router.addLiquidity(dai.address, usdc.address, CASH_AMOUNT, CASH_AMOUNT, CASH_AMOUNT, CASH_AMOUNT, deployer, timestamp + 10000000);
    log('+ Added liquidity for DAI / USDC pair');
    // TODO: WETH RELATED LIQUIDITY
    // await weth.deposit({ value: ONE_ETH });
    // log('+ Deposited 1 ETH for WETH');
    // web3.eth.getBalance(address [, defaultBlock] [, callback])
  } else {
    log('+ Unknown network. Skipped tokens deployment');
  }
};

module.exports.tags = ['tokens'];
