const DAOstackMigration = require('@daostack/migration');
const migrationSpec = require('../data/necDAO.json');
require('dotenv').config();

async function migrate() {
  const DEFAULT_GAS = 3.5;

  const options = {
    provider: process.env.PROVIDER,
    gasPrice: DEFAULT_GAS,
    quiet: false,
    force: true,
    restart: true,
    output: process.env.OUTPUT_FILE,
    // privateKey: process.env.PRIVATE_KEY,
    mnemonic: process.env.MNEMONIC,
    customAbisLocation: process.env.CUSTOM_ABI_LOCATION,
    params: {
      private: migrationSpec,
      rinkeby: migrationSpec,
    },
  };

  // migrate base contracts over ganache
  switch (process.env.NETWORK) {
    case 'private':
      const migrationBaseResult = await DAOstackMigration.migrateBase(options);
      options.prevmigration = options.output;
      break;
  }

  const migrationDAOResult = await DAOstackMigration.migrateDAO(options);
}

migrate();
