module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxy = await deploy('UniswapProxy', {
    contract: 'UniswapProxy',
    from: deployer,
  });
  log('+ Deployed UniswapProxy at ' + proxy.address);
};
