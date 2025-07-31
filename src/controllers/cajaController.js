const BaseController = require("./baseController");
const Caja = require("../models/caja.model");

class CajaController extends BaseController {
  constructor() {
    super(Caja);
  }

  // Crear caja con validaciones específicas
  async createCaja(cajaData) {
    try {
      // Validar que el nombre sea único
      const existingCaja = await this.model.findOne({
        nombre: cajaData.nombre,
      });

      if (existingCaja) {
        return { success: false, error: "Ya existe una caja con ese nombre" };
      }

      return await this.create(cajaData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Buscar caja por nombre
  async getByNombre(nombre) {
    try {
      const caja = await this.model.findOne({ nombre });
      if (!caja) {
        return { success: false, error: "Caja no encontrada" };
      }
      return { success: true, data: caja };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener todas las cajas ordenadas por nombre
  async getAllCajas() {
    try {
      const cajas = await this.model.find().sort({ nombre: 1 });
      return { success: true, data: cajas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verificar si una caja existe
  async cajaExists(nombre) {
    try {
      const caja = await this.model.findOne({ nombre });
      return { success: true, exists: !!caja };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CajaController();
