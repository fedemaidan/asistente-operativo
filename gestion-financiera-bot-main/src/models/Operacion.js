const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const Operacion = sequelize.define('Operacion', {
    monto: {
        type: DataTypes.DECIMAL,
        allowNull: false,
    },
    numero_operacion: {
        type: DataTypes.STRING,
    },
    banco_emisor: {
        type: DataTypes.STRING,
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    cliente_envia: {
        type: DataTypes.STRING,
    },
    cliente_recibe: {
        type: DataTypes.STRING,
    },
    tipo: {
        type: DataTypes.STRING,
    },
    interes_extra: {
        type: DataTypes.DECIMAL,
    },
    estado: {
        type: DataTypes.STRING,
        defaultValue: 'pendiente',
    },
});

module.exports = Operacion;
