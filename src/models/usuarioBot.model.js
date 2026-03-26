const mongoose = require("mongoose");

const PERFIL_KEYS = [
  "celulandiaDev",
  "celulandia",
  "financieraDev",
  "financiera",
  "driveDev",
  "drive",
];

const usuarioBotSchema = new mongoose.Schema(
  {
    telefono: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    perfilKey: {
      type: String,
      required: true,
      enum: PERFIL_KEYS,
    },
    nombres: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const UsuarioBot = mongoose.model("UsuarioBot", usuarioBotSchema);

module.exports = UsuarioBot;
module.exports.PERFIL_KEYS = PERFIL_KEYS;
