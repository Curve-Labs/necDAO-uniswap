const DAOstackMigration = require('@daostack/migration');
const bre = require('@nomiclabs/buidler');
const specs = require('./necDAO.json');

const migrate = async () => {
  const { log, get } = bre.deployments;

  const proxy = await get('UniswapProxy');
  specs.CustomSchemes[0].address = proxy.address;
  specs.CustomSchemes[1].params[2] = proxy.address;

  const options = {
    network: bre.network.name,
    provider: bre.network.config.url,
    privateKey: process.env.KEY || '242d567b6917dce8f836dc1fb190259c65998d38b14dddf2b94f45f41bb9fd19',
    customAbisLocation: './artifacts',
    quiet: false,
    force: true,
    restart: true,
    params: {
      rinkeby: specs,
    },
  };

  const result = await DAOstackMigration.migrateDAO(options);
  log('+ Deployed DAO at ' + result.dao['0.0.1-rc.44'].Avatar);
};

migrate();
