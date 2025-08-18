const BaseController = require("./baseController.js");
const Movimiento = require("../models/movimiento.model.js");
const Cliente = require("../models/cliente.model.js");
const Caja = require("../models/caja.model.js");
const DolarService = require("../services/monedasService/dolarService.js");
const {
  addMovimientoToSheet,
} = require("../Utiles/GoogleServices/Sheets/comprobante.js");
const CuentaPendienteController = require("./cuentaPendienteController.js");

class MovimientoController extends BaseController {
  constructor() {
    super(Movimiento);
  }
  async createMovimiento(movimientoData, montoEnviado, saveToSheet = true) {
    console.log(movimientoData);
    console.log(montoEnviado);

    try {
      const cotizaciones = await DolarService.obtenerValoresDolar();
      if (movimientoData.type === "EGRESO") {
        movimientoData.total = {
          ars: montoEnviado,
          usdOficial: montoEnviado,
          usdBlue: montoEnviado,
        };
      } else if (movimientoData.moneda === "ARS") {
        movimientoData.total = {
          ars: montoEnviado,
          usdOficial: montoEnviado / cotizaciones.oficial.venta,
          usdBlue: montoEnviado / cotizaciones.blue.venta,
        };
      } else if (movimientoData.moneda === "USD") {
        movimientoData.total = {
          ars: montoEnviado * cotizaciones.oficial.venta,
          usdOficial: montoEnviado,
          usdBlue: montoEnviado,
        };
      }
      const movimiento = await this.create(movimientoData);

      if (movimiento?.success && movimiento?.data?._id) {
        const populated = await this.model
          .findById(movimiento.data._id)
          .populate("caja");
        if (saveToSheet) {
          await addMovimientoToSheet(populated, process.env.GOOGLE_SHEET_ID);
        }
      }

      return movimiento;
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

      const { nombreUsuario, ...datosMovimiento } = movimientoData;

      const updateData = {
        ...datosMovimiento,
        nombreUsuario: nombreUsuario,
      };

      return await this.update(id, updateData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getByCliente(clienteId) {
    try {
      const movimientos = await this.model
        .find({ clienteId: clienteId })
        .populate("cliente")
        .populate("caja")
        .sort({ fechaFactura: -1 });
      return { success: true, data: movimientos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

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

  async getClientesTotales() {
    try {
      const clientes = await Cliente.find({});

      const movimientos = await this.model.find({}).populate("cliente");

      const cuentasResp =
        await CuentaPendienteController.getByProveedorOCliente("");
      const cuentasPendientes = cuentasResp?.success ? cuentasResp.data : [];
      const pendientesPorCliente = cuentasPendientes.reduce((acc, cuenta) => {
        const nombre = (cuenta.proveedorOCliente || "")
          .toString()
          .trim()
          .toLowerCase();
        if (!acc[nombre]) {
          acc[nombre] = { ars: 0, usdBlue: 0, usdOficial: 0 };
        }
        const cc = cuenta.cc;
        const monto = cuenta.montoTotal || {};
        if (cc === "ARS") {
          acc[nombre].ars += Number(monto.ars || 0);
        } else if (cc === "USD BLUE") {
          acc[nombre].usdBlue += Number(monto.usdBlue || 0);
        } else if (cc === "USD OFICIAL") {
          acc[nombre].usdOficial += Number(monto.usdOficial || 0);
        }
        return acc;
      }, {});

      const clientesTotales = clientes.map((cliente) => {
        const movimientosCliente = movimientos.filter(
          (mov) =>
            mov.clienteId && mov.clienteId.toString() === cliente._id.toString()
        );

        const cuentasPendientesCliente = cuentasPendientes.filter((cuenta) => {
          const nombreCuenta = (cuenta.proveedorOCliente || "")
            .toString()
            .trim()
            .toLowerCase();
          const nombreCliente = (cliente.nombre || "")
            .toString()
            .trim()
            .toLowerCase();
          return nombreCuenta === nombreCliente;
        });

        let totalARS = 0;
        let totalUSDBlue = 0;
        let totalUSDOficial = 0;
        let fechaUltimoMovimiento = null;

        movimientosCliente.forEach((mov) => {
          if (mov.cuentaCorriente === "ARS") {
            if (mov.type === "INGRESO") {
              totalARS += mov.total?.ars || 0;
            } else {
              totalARS -= mov.total?.ars || 0;
            }
          } else if (mov.cuentaCorriente === "USD BLUE") {
            if (mov.type === "INGRESO") {
              totalUSDBlue += mov.total?.usdBlue || 0;
            } else {
              totalUSDBlue -= mov.total?.usdBlue || 0;
            }
          } else if (mov.cuentaCorriente === "USD OFICIAL") {
            if (mov.type === "INGRESO") {
              totalUSDOficial += mov.total?.usdOficial || 0;
            } else {
              totalUSDOficial -= mov.total?.usdOficial || 0;
            }
          }

          if (
            !fechaUltimoMovimiento ||
            mov.fechaCreacion > fechaUltimoMovimiento
          ) {
            fechaUltimoMovimiento = mov.fechaCreacion;
          }
        });

        cuentasPendientesCliente.forEach((cuenta) => {
          const fechaCuenta = cuenta.fechaCuenta || cuenta.fechaCreacion;
          if (
            fechaCuenta &&
            (!fechaUltimoMovimiento || fechaCuenta > fechaUltimoMovimiento)
          ) {
            fechaUltimoMovimiento = fechaCuenta;
          }
        });

        const nombreNormalizado = (cliente.nombre || "")
          .toString()
          .trim()
          .toLowerCase();
        const pendientes = pendientesPorCliente[nombreNormalizado] || {
          ars: 0,
          usdBlue: 0,
          usdOficial: 0,
        };
        totalARS += pendientes.ars || 0;
        totalUSDBlue += pendientes.usdBlue || 0;
        totalUSDOficial += pendientes.usdOficial || 0;

        return {
          _id: cliente._id,
          cliente: cliente.nombre,
          ARS: totalARS,
          "USD BLUE": totalUSDBlue,
          "USD OFICIAL": totalUSDOficial,
          fechaUltimoMovimiento: fechaUltimoMovimiento,
        };
      });

      clientesTotales.sort((a, b) => a.cliente.localeCompare(b.cliente));

      return { success: true, data: clientesTotales };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

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

  async getLogs(id) {
    try {
      const movimiento = await this.model.findById(id).select("logs");
      if (!movimiento) {
        return { success: false, error: "Movimiento no encontrado" };
      }
      return { success: true, data: movimiento.logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MovimientoController();
