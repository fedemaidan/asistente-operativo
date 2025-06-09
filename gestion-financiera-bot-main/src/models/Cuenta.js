const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const Cuenta = sequelize.define('Cuenta', {
    cliente: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    tipo: {
        type: DataTypes.STRING, // 'cobrar' o 'pagar'
        allowNull: false,
    },
    monto: {
        type: DataTypes.DECIMAL,
        allowNull: false,
    },
    fecha: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

module.exports = Cuenta;
