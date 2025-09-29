const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema({
  codigos: {
    type: [String],
    default: [],
  },
  nombre: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Tag", tagSchema);
