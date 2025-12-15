const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
  }
});

module.exports = mongoose.model("Tag", tagSchema);
