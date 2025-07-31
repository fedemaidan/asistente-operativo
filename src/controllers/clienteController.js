const BaseController = require("./baseController");
const Cliente = require("../models/cliente.model");

class ClienteController extends BaseController {
  constructor() {
    super(Cliente);
  }

  // Crear cliente con validaciones específicas
  async createCliente(clienteData) {
    try {
      // Validar que el nombre sea único
      const existingCliente = await this.model.findOne({
        nombre: clienteData.nombre,
      });

      if (existingCliente) {
        return { success: false, error: "Ya existe un cliente con ese nombre" };
      }

      return await this.create(clienteData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Buscar cliente por nombre
  async getByNombre(nombre) {
    try {
      const cliente = await this.model.findOne({ nombre });
      if (!cliente) {
        return { success: false, error: "Cliente no encontrado" };
      }
      return { success: true, data: cliente };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener clientes con cuentas activas específicas
  async getByCuentaActiva(cuenta) {
    try {
      const clientes = await this.model.find({
        ccActivas: cuenta,
      });
      return { success: true, data: clientes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar cuentas activas de un cliente
  async updateCuentasActivas(id, cuentasActivas) {
    try {
      const updatedCliente = await this.model.findByIdAndUpdate(
        id,
        { ccActivas: cuentasActivas },
        { new: true, runValidators: true }
      );

      if (!updatedCliente) {
        return { success: false, error: "Cliente no encontrado" };
      }

      return { success: true, data: updatedCliente };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas de clientes
  async getEstadisticas() {
    try {
      const totalClientes = await this.model.countDocuments();
      const clientesConDescuento = await this.model.countDocuments({
        descuento: { $gt: 0 },
      });

      return {
        success: true,
        data: {
          totalClientes,
          clientesConDescuento,
          clientesSinDescuento: totalClientes - clientesConDescuento,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ClienteController();
