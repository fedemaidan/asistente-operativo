const mongoose = require("mongoose");

const productosIgnorarSchema = new mongoose.Schema({
  codigo: {
    type: String,
    unique: true,
    required: true,
  },
  descripcion: {
    type: String,
    default: null,
  },
});

const ProductosIgnorar = mongoose.model(
  "ProductosIgnorar",
  productosIgnorarSchema
);
module.exports = ProductosIgnorar;
