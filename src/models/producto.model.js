const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const ProductoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
  },
  descripcion: {
    type: String,
    required: true,
  },
  stockActual: {
    type: Number,
    required: true,
  }
}, {
  timestamps: {
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    currentTime: getFechaArgentina,
  },
});

const Producto = mongoose.model("Producto", ProductoSchema);
module.exports = Producto;