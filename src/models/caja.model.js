import mongoose from "mongoose";

const cajaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
  },
});

const Caja = mongoose.model("Caja", cajaSchema);
export default Caja;
