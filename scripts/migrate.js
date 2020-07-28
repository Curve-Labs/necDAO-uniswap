const DAOstackMigration = require('@daostack/migration');
const migrationSpec = require('../data/necDAO.json');
require('dotenv').config();

async function migrate() {
  const DEFAULT_GAS = 3.5;

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
      // migrationSpec,
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
}

migrate();
