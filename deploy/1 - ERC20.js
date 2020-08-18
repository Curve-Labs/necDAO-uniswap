module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  if ((await getChainId()) === '4') {
    const DAI = await deploy('DAI', {
      contract: 'ERC20Mock',
      from: deployer,
      args: ['DAI Stablecoin', 'DAI', 18],
    });
    log('+ Deployed DAI at ' + DAI.address);

    const USDC = await deploy('USDC', {
      contract: 'ERC20Mock',
      from: deployer,
      args: ['USDC Stablecoin', 'USDC', 15],
    });
    log('+ Deployed USDC at ' + USDC.address);
  } else {
    log('+ Skipped tokens deployment');
  }
};
