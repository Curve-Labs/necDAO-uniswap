const DAOstackMigration = require('@daostack/migration');
const migrationSpec = require('../data/necDAO.json');
// const fs = require('fs').promises;
// var path = require('path');
require('dotenv').config();

const deployed = require('./deployed.json');
// const MIGRATION_PATH = '../../migration/migration.json';
// const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
// const INITIAL_CASH_SUPPLY = '2000000000000000000000';
// const ROOT = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';

const migrate = async () => {
  migrationSpec.CustomSchemes[0].params[2] = deployed.scheme;
  const options = {
    //   provider: process.env.PROVIDER,
    gasPrice: 3.5,
    gasLimit: 9990000,
    quiet: false,
    force: true,
    restart: true,
    // output: './data/migration.json',
    mnemonic: process.env.MNEMONIC,
    //   customAbisLocation: process.env.CUSTOM_ABI_LOCATION,
    params: {
      private: migrationSpec,
      rinkeby: migrationSpec,
    },
  };
  // migrate base contracts over ganache
  switch (process.env.NETWORK) {
    case 'private':
      const migrationBaseResult = await DAOstackMigration.migrateBase(options);
      // console.log(migrationBaseResult);
      // options.previousMigration = { base: migrationBaseResult };
      break;
  }
  const migrationDAOResult = await DAOstackMigration.migrateDAO(options);
  console.log(migrationDAOResult);
  const avatar = migrationDAOResult.dao['0.0.1-rc.44'].Avatar;
  console.log(avatar);
};

migrate();
