usePlugin('@nomiclabs/buidler-solhint');
usePlugin('@nomiclabs/buidler-truffle5');
usePlugin('buidler-deploy');
usePlugin('buidler-gas-reporter');
usePlugin('solidity-coverage');

module.exports = {
  solc: {
    version: '0.5.13',
    optimizer: { enabled: true, runs: 10 },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
      4: '0xb71d2d88030a00830c3d45f84c12cc8aaf6857a5', // but for rinkeby it will be a specific address
    },
  },
  networks: {
    rinkeby: {
      url: 'http://127.0.0.1:1248',
    },
    coverage: {
      gas: 0x1fffffffffffff,
      url: 'http://localhost:8555',
    },
  },
};
