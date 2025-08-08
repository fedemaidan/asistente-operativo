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

  // Actualizar cliente completo - los logs se manejan automáticamente con el middleware
  async updateCliente(id, clienteData) {
    try {
      // Verificar que el nombre no esté duplicado (excluyendo el cliente actual)
      if (clienteData.nombre) {
        const existingCliente = await this.model.findOne({
          nombre: clienteData.nombre,
          _id: { $ne: id },
        });

        if (existingCliente) {
          return {
            success: false,
            error: "Ya existe un cliente con ese nombre",
          };
        }
      }

      const { usuario, ...datosCliente } = clienteData;

      const updateData = {
        ...datosCliente,
        usuario: usuario,
      };

      return await this.update(id, updateData);
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

  // Actualizar cuentas activas de un cliente - los logs se manejan automáticamente
  async updateCuentasActivas(id, cuentasActivas, usuario) {
    try {
      const clienteOriginal = await this.model.findById(id);
      if (!clienteOriginal) {
        return { success: false, error: "Cliente no encontrado" };
      }

      // Verificar si realmente hay cambios
      if (
        JSON.stringify(clienteOriginal.ccActivas) ===
        JSON.stringify(cuentasActivas)
      ) {
        return {
          success: false,
          error: "No hay cambios en las cuentas activas",
        };
      }

      // Usar el método update del BaseController - el middleware se encarga de los logs
      return await this.update(id, {
        ccActivas: cuentasActivas,
        usuario: usuario, // Se usa solo para los logs
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener logs de un cliente
  async getLogs(id) {
    try {
      const cliente = await this.model.findById(id).select("logs");
      if (!cliente) {
        return { success: false, error: "Cliente no encontrado" };
      }
      return { success: true, data: cliente.logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cliente con logs
  async getClienteWithLogs(id) {
    try {
      const cliente = await this.model.findById(id);
      if (!cliente) {
        return { success: false, error: "Cliente no encontrado" };
      }
      return { success: true, data: cliente };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ClienteController();
