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
  async getByProveedorOCliente(proveedorOCliente) {
    try {
      const cuentas = await this.model
        .find({
          proveedorOCliente: new RegExp(proveedorOCliente, "i"),
        })
        .sort({ fechaCuenta: -1 });

      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cuentas pendientes por moneda
  async getByMoneda(moneda) {
    try {
      const cuentas = await this.model
        .find({ moneda })
        .sort({ fechaCuenta: -1 });
      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cuentas pendientes por rango de fechas
  async getByFechaRange(fechaInicio, fechaFin) {
    try {
      const cuentas = await this.model
        .find({
          fechaCuenta: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin),
          },
        })
        .sort({ fechaCuenta: -1 });

      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Calcular total de cuentas pendientes por moneda
  async getTotalByMoneda(moneda) {
    try {
      const result = await this.model.aggregate([
        { $match: { moneda } },
        { $group: { _id: null, total: { $sum: "$montoTotal" } } },
      ]);

      const total = result.length > 0 ? result[0].total : 0;
      return { success: true, data: total };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas de cuentas pendientes
  async getEstadisticas() {
    try {
      const totalCuentas = await this.model.countDocuments();
      const totalARS = await this.getTotalByMoneda("ARS");
      const totalUSD = await this.getTotalByMoneda("USD");

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
}

module.exports = new CuentaPendienteController();
