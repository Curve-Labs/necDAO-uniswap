require('babel-register');
require('babel-polyfill');

const gasReporter = {
  reporter: 'eth-gas-reporter',
  reporterOptions: {
    currency: 'USD',
  },
};

const mocha = process.env.GAS_REPORTER ? gasReporter : {};

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    },
    kovan: {
      host: '127.0.0.1',
      port: 1248,
      gas: 9000000,
      gasPrice: 5e9,
      network_id: 42,
    },
    mainnet: {
      host: '127.0.0.1',
      port: 1248,
      network_id: 1,
    },
  },
  plugins: ['solidity-coverage'],
  mocha,
  compilers: {
    solc: {
      version: '0.5.13',
      settings: {
        optimizer: {
          enabled: true,
          runs: 1,
        },
      },
    },
  },
};
