const BaseController = require("./baseController");
const StockProyeccion = require("../models/productoProyeccion.model");

class StockProyeccionController extends BaseController {
  constructor() {
    super(StockProyeccion);
  }

  async getStockPorProyeccionId(proyeccionId) {
    try {
      const result = await this.model.find({ proyeccionId });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new StockProyeccionController();
