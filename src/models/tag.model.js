const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
  }, color: {
    type: String,
    required: true,
  }
});

module.exports = mongoose.model("Tag", tagSchema);
