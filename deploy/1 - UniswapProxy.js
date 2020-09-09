module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxy = await deploy('UniswapProxy', {
    contract: 'UniswapProxy',
    from: deployer,
    proxy: true,
  });
  log('+ Deployed UniswapProxy at ' + proxy.address);
};

module.exports.tags = ['proxy'];
