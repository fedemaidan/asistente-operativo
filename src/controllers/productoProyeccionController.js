const BaseController = require("./baseController");
const ProductoProyeccion = require("../models/productoProyeccion.model");

class ProductoProyeccionController extends BaseController {
  constructor() {
    super(ProductoProyeccion);
  }
}

module.exports = new ProductoProyeccionController();
