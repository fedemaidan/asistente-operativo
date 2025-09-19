const mongoose = require("mongoose");

const proyeccionSchema = new mongoose.Schema({
  fechaInicio: {
    type: Date,
    required: true,
  },
  fechaFin: {
    type: Date,
    required: true,
  },
  linkVenta: {
    type: String,
    required: true,
  },
  linkProyeccion: {
    type: String,
    required: true,
  },
});

const Caja = mongoose.model("Proyeccion", proyeccionSchema);
module.exports = Proyeccion;
