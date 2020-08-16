usePlugin('@nomiclabs/buidler-solhint');
usePlugin('@nomiclabs/buidler-truffle5');
usePlugin('buidler-gas-reporter');

module.exports = {
  solc: {
    version: '0.5.13',
    optimizer: { enabled: true, runs: 10 },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
};
