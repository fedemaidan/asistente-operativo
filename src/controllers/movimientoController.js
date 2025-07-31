const BaseController = require("./baseController");
const Movimiento = require("../models/movimiento.model.js");
const Cliente = require("../models/cliente.model.js");
const Caja = require("../models/caja.model.js");

class MovimientoController extends BaseController {
  constructor() {
    super(Movimiento);
  }

  async createMovimiento(movimientoData) {
    try {
      if (movimientoData.total <= 0) {
        return { success: false, error: "El total debe ser mayor que 0" };
      }

      if (movimientoData.cliente) {
        const cliente = await Cliente.findById(movimientoData.cliente);
        if (!cliente) {
          return { success: false, error: "Cliente no encontrado" };
        }
      }

      // Validar que la caja existe
      if (movimientoData.caja) {
        const caja = await Caja.findById(movimientoData.caja);
        if (!caja) {
          return { success: false, error: "Caja no encontrada" };
        }
      }

      return await this.create(movimientoData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateMovimiento(id, movimientoData) {
    try {
      if (movimientoData.total !== undefined && movimientoData.total <= 0) {
        return { success: false, error: "El total debe ser mayor que 0" };
      }

      if (movimientoData.cliente) {
        const cliente = await Cliente.findById(movimientoData.cliente);
        if (!cliente) {
          return { success: false, error: "Cliente no encontrado" };
        }
      }

      if (movimientoData.caja) {
        const caja = await Caja.findById(movimientoData.caja);
        if (!caja) {
          return { success: false, error: "Caja no encontrada" };
        }
      }

      return await this.update(id, movimientoData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener movimientos por cliente
  async getByCliente(clienteId) {
    try {
      const movimientos = await this.model
        .find({ cliente: clienteId })
        .populate("cliente")
        .populate("caja")
        .sort({ fechaFactura: -1 });
      return { success: true, data: movimientos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener movimientos por caja
  async getByCaja(cajaId) {
    try {
      const movimientos = await this.model
        .find({ caja: cajaId })
        .populate("cliente")
        .populate("caja")
        .sort({ fechaFactura: -1 });
      return { success: true, data: movimientos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener movimientos por tipo (ingreso/egreso)
  async getByType(type) {
    try {
      const movimientos = await this.model
        .find({ type })
        .populate("cliente")
        .populate("caja")
        .sort({ fechaFactura: -1 });
      return { success: true, data: movimientos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener movimientos por rango de fechas
  async getByFechaRange(fechaInicio, fechaFin) {
    try {
      const movimientos = await this.model
        .find({
          fechaFactura: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin),
          },
        })
        .populate("cliente")
        .populate("caja")
        .sort({ fechaFactura: -1 });
      return { success: true, data: movimientos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Calcular total de movimientos por tipo
  async getTotalByType(type) {
    try {
      const result = await this.model.aggregate([
        { $match: { type } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]);
      const total = result.length > 0 ? result[0].total : 0;
      return { success: true, data: total };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas de movimientos
  async getEstadisticas() {
    try {
      const totalMovimientos = await this.model.countDocuments();
      const totalIngresos = await this.getTotalByType("INGRESO");
      const totalEgresos = await this.getTotalByType("EGRESO");
      const movimientosPorTipo = await this.model.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]);

      return {
        success: true,
        data: {
          totalMovimientos,
          totalIngresos: totalIngresos.data,
          totalEgresos: totalEgresos.data,
          balance: totalIngresos.data - totalEgresos.data,
          movimientosPorTipo,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MovimientoController();
