const { Sequelize } = require('sequelize');
require('dotenv').config();

// Crear instancia de Sequelize
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false, // Desactiva logs de SQL
});

// Probar conexión
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Conexión exitosa a PostgreSQL con Sequelize');
    } catch (error) {
        console.error('Error conectando a la base de datos:', error);
    }
})();

module.exports = sequelize;
