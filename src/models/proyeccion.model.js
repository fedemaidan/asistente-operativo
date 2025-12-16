const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const ProyeccionSchema = new mongoose.Schema(
  {
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    horizonte: {
      type: Number,
      default: 90,
    },
    dateDiff: {
      type: Number,
      required: false,
      default: 0,
    },
    fechaInicio: {
      type: Date,
      required: false,
      default: null,
    },
    fechaFin: {
      type: Date,
      required: false,
      default: null,
    },
    fechaBase: {
      type: Date,
      required: false,
      default: null,
    },
    ventasData: {
      type: [mongoose.Schema.Types.Mixed],
      required: false,
      default: [],
    },
    stockData: {
      type: [mongoose.Schema.Types.Mixed],
      required: false,
      default: [],
    },
    quiebreData: {
      type: [mongoose.Schema.Types.Mixed],
      required: false,
      default: [],
    },
    links: {
      ventas: { type: String, default: "" },
      stock: { type: String, default: "" },
      quiebre: { type: String, default: "" },
    },
    lastRecalculatedAt: {
      type: Date,
      default: null,
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

ProyeccionSchema.index({ active: 1, createdAt: -1 });

const Proyeccion = mongoose.model("Proyeccion", ProyeccionSchema);
module.exports = Proyeccion;


