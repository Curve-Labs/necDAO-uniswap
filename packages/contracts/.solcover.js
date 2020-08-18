const exec = require('child_process').exec;

async function copyABIs() {
  CMD =
    'cp artifacts/UniswapV2Factory.json .coverage_artifacts/ && cp artifacts/UniswapV2Router.json .coverage_artifacts/ && cp artifacts/WETH.json .coverage_artifacts/';
  return new Promise((resolve, reject) => {
    exec(CMD, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
        reject(stderr);
      }
      resolve(stdout ? stdout : stderr);
    });
  });
}

module.exports = {
  skipFiles: ['test/Import.sol', 'test/ERC20Mock', 'uniswap/IUniswapV2Router02.sol'],
  providerOptions: {
    gasLimit: 0x1fffffffffffff,
    allowUnlimitedContractSize: true,
    default_balance_ether: 0x1fffffffffffff,
  },
  onCompileComplete: copyABIs,
};
