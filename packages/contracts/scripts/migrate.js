const DAOstackMigration = require('@daostack/migration');
require('dotenv').config();

const specs = require('./necDAO.json');
const proxy = require('../deployments/rinkeby/UniswapProxy.json');

const migrate = async () => {
  specs.CustomSchemes[0].address = proxy.address;
  specs.CustomSchemes[1].params[2] = proxy.address;

  const options = {
    network: 'rinkeby',
    provider: 'http://127.0.0.1:1248',
    privateKey: process.env.KEY,
    customAbisLocation: '../contracts/artifacts',
    quiet: true,
    force: true,
    restart: true,
    params: {
      rinkeby: specs,
    },
  };

  const result = await DAOstackMigration.migrateDAO(options);
  console.log('+ Deployed DAO at ' + result.dao['0.0.1-rc.44'].Avatar);
};

migrate();
