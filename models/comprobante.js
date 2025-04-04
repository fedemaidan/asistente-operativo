'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Comprobante extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Comprobante.init({
    numero_comprobante: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Comprobante',
  });
  return Comprobante;
};