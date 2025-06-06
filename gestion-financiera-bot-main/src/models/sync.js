const sequelize = require('./index');
const Operacion = require('./Operacion');
const Cuenta = require('./Cuenta');

(async () => {
    try {
        await sequelize.sync({ alter: true }); // Sincroniza los modelos con la base de datos
        console.log('Modelos sincronizados con la base de datos');
    } catch (error) {
        console.error('Error sincronizando los modelos:', error);
    } finally {
        await sequelize.close();
    }
})();
