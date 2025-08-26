const BaseController = require("./baseController");
const CuentaPendiente = require("../models/cuentaPendiente.model");

class CuentaPendienteController extends BaseController {
  constructor() {
    super(CuentaPendiente);
  }

  // Crear cuenta pendiente con validaciones específicas
  async createCuentaPendiente(cuentaData) {
    try {
      console.log("cuentaData", cuentaData);
      // Validar que el monto sea mayor que 0
      if (cuentaData.montoTotal && cuentaData.montoTotal.ars >= 0) {
        return { success: false, error: "El monto total debe ser menor que 0" };
      }

      return await this.create(cuentaData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar cuenta pendiente con usuario para logs
  async updateCuentaPendiente(id, cuentaData) {
    try {
      const { usuario, ...datosCuenta } = cuentaData;

      const updateData = {
        ...datosCuenta,
        usuario: usuario,
      };

      return await this.update(id, updateData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cuentas pendientes por proveedor/cliente
  async getByProveedorOCliente(proveedorOCliente, includeInactive = false) {
    try {
      const query = {
        proveedorOCliente: new RegExp(proveedorOCliente, "i"),
      };

      if (!includeInactive) {
        query.active = true;
      }

      const cuentas = await this.model.find(query).sort({ fechaCuenta: -1 });

      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cuentas pendientes por moneda
  async getByMoneda(moneda, includeInactive = false) {
    try {
      const query = { moneda };

      if (!includeInactive) {
        query.active = true;
      }

      const cuentas = await this.model.find(query).sort({ fechaCuenta: -1 });
      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cuentas pendientes por rango de fechas
  async getByFechaRange(fechaInicio, fechaFin, includeInactive = false) {
    try {
      const query = {
        fechaCuenta: {
          $gte: new Date(fechaInicio),
          $lte: new Date(fechaFin),
        },
      };

      if (!includeInactive) {
        query.active = true;
      }

      const cuentas = await this.model.find(query).sort({ fechaCuenta: -1 });

      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Calcular total de cuentas pendientes por moneda
  async getTotalByMoneda(moneda, includeInactive = false) {
    try {
      const matchStage = { moneda };

      if (!includeInactive) {
        matchStage.active = true;
      }

      const result = await this.model.aggregate([
        { $match: matchStage },
        { $group: { _id: null, total: { $sum: "$montoTotal" } } },
      ]);

      const total = result.length > 0 ? result[0].total : 0;
      return { success: true, data: total };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas de cuentas pendientes
  async getEstadisticas(includeInactive = false) {
    try {
      const query = {};
      if (!includeInactive) {
        query.active = true;
      }

      const totalCuentas = await this.model.countDocuments(query);
      const totalARS = await this.getTotalByMoneda("ARS", includeInactive);
      const totalUSD = await this.getTotalByMoneda("USD", includeInactive);

      return {
        success: true,
        data: {
          totalCuentas,
          totalARS: totalARS.data,
          totalUSD: totalUSD.data,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getByClienteId(clienteId, includeInactive = false) {
    try {
      // Primero obtenemos el cliente para obtener su nombre
      const Cliente = require("../models/cliente.model");
      const cliente = await Cliente.findById(clienteId);
      if (!cliente) {
        return { success: false, error: "Cliente no encontrado" };
      }

      // Normalizamos el nombre del cliente para la búsqueda
      const nombreCliente = cliente.nombre.toString().trim().toLowerCase();

      // Buscamos cuentas pendientes donde proveedorOCliente coincida con el nombre del cliente
      const query = {
        $expr: {
          $eq: [
            { $toLower: { $trim: { input: "$proveedorOCliente" } } },
            nombreCliente,
          ],
        },
      };

      if (!includeInactive) {
        query.active = true;
      }

      const cuentas = await this.model.find(query).sort({ fechaCuenta: -1 });

      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener logs de una cuenta pendiente
  async getLogs(id) {
    try {
      const cuenta = await this.model.findById(id).select("logs");
      if (!cuenta) {
        return { success: false, error: "Cuenta pendiente no encontrada" };
      }
      return { success: true, data: cuenta.logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Eliminar lógicamente una cuenta pendiente
  async deleteCuentaPendiente(id, usuario) {
    try {
      const result = await this.model.findByIdAndUpdate(
        id,
        {
          active: false,
          usuario: usuario || "Sistema",
        },
        { new: true }
      );

      if (!result) {
        return { success: false, error: "Cuenta pendiente no encontrada" };
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CuentaPendienteController();
