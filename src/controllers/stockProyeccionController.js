const BaseController = require("./baseController");
const StockProyeccion = require("../models/productoProyeccion.model");

class StockProyeccionController extends BaseController {
  constructor() {
    super(StockProyeccion);
  }
}

module.exports = new StockProyeccionController();
