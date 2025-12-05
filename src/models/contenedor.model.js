const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const contenedorSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: true,
      unique: true,
    },
    fechaEstimadaLlegada: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      currentTime: getFechaArgentina,
    },
  }
);

const Contenedor = mongoose.model("Contenedor", contenedorSchema);
module.exports = Contenedor;