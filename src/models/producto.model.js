const mongoose = require("mongoose");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");

const ProductoSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: true,
    },
    nombre: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
        required: false,
      },
    ],
    stockActual: {
      type: Number,
      required: true,
    },
    ventasPeriodo: {
      type: Number,
      required: true,
    },
    stockProyectado: {
      type: Number,
      default: 0,
    },
    ventasProyectadas: {
      type: Number,
      required: true,
    },
    // Fecha en la que se proyecta que el stock llegue a 0
    fechaAgotamientoStock: {
      type: Date,
      required: false,
    },
    cantidadCompraSugerida: {
      type: Number,
      default: 0,
    },
    fechaCompraSugerida: {
      type: Date,
      required: false,
    },
    seAgota: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
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

ProductoSchema.index({ codigo: 1 });
ProductoSchema.index({ nombre: 1 });

const Producto = mongoose.model("Producto", ProductoSchema);
module.exports = Producto;