const mongoose = require("mongoose");

const productoProyeccionSchema = new mongoose.Schema({
  descripcion: {
    type: String,
    required: true,
  },
  proyeccionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Proyeccion",
    required: false,
  },
  codigo: {
    type: String,
    required: true,
  },
  cantidad: {
    type: Number,
    required: true,
  },
  ventasPeriodo: {
    type: Number,
    required: true,
  },
  ventasProyectadas: {
    type: Number,
    required: true,
  },
  diasSinStock: {
    type: Number,
    required: true,
  },
});

const ProductoProyeccion = mongoose.model(
  "ProductoProyeccion",
  productoProyeccionSchema
);
module.exports = ProductoProyeccion;
