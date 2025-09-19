const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const proyeccionSchema = new mongoose.Schema({
  fechaInicio: {
    type: Date,
    required: true,
  },
  fechaFin: {
    type: Date,
    required: true,
  },
  linkStock: {
    type: String,
    required: true,
  },
  linkVentas: {
    type: String,
    required: true,
  },
  fechaCreacion: {
    type: Date,
    default: getFechaArgentina,
  },
});

const Proyeccion = mongoose.model("Proyeccion", proyeccionSchema);
module.exports = Proyeccion;
