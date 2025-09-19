const BaseController = require("./baseController");
const ProductosIgnorar = require("../models/productosIngorar.model");

class ProductoIgnorarController extends BaseController {
  constructor() {
    super(ProductosIgnorar);
  }
}

module.exports = new ProductoIgnorarController();
