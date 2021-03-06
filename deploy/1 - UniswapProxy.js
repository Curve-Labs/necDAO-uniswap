const AVATAR = "0xe56b4d8d42b1c9ea7dda8a6950e3699755943de7";
const ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxy = await deploy('UniswapProxy', {
    contract: 'UniswapProxy',
    from: deployer,
    proxy: "initialize",
    args: [AVATAR, ROUTER]
  });
  log('+ Deployed UniswapProxy at ' + proxy.address);
};

module.exports.tags = ['proxy'];
