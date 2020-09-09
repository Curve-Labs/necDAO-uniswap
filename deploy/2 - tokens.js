module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  if ((await getChainId()) == '4') {
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
  } else {
    log('+ Unknown network. Skipped tokens deployment.');
  }
};

module.exports.tags = ['tokens'];
