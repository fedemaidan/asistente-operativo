const BaseController = require("./baseController");
const Proyeccion = require("../models/proyeccion.model");

class ProyeccionController extends BaseController {
  constructor() {
    super(Proyeccion);
  }
}

module.exports = new ProyeccionController();
