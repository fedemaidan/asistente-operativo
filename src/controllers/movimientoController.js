const BaseController = require("./baseController.js");
const Movimiento = require("../models/movimiento.model.js");
const Cliente = require("../models/cliente.model.js");
const Caja = require("../models/caja.model.js");
const DolarService = require("../services/monedasService/dolarService.js");
const CuentaPendienteController = require("./cuentaPendienteController.js");

class MovimientoController extends BaseController {
  constructor() {
    super(Movimiento);
  }
  async createMovimiento(
    movimientoData,
    montoEnviado,
    saveToSheet = true,
    calcular = true
  ) {
    console.log("movimientoData", movimientoData);
    console.log("montoEnviado", montoEnviado);
    const { type, moneda, cuentaCorriente } = movimientoData;
    let tipoDeCambio = movimientoData.tipoDeCambio || null;
    const cotizaciones = await DolarService.obtenerValoresDolar();
    const { blue, oficial } = cotizaciones;

    try {
      if (calcular) {
        if (!movimientoData.tipoDeCambio) {
          if (
            (moneda === "ARS" && cuentaCorriente === "ARS") ||
            (moneda === "USD" && cuentaCorriente === "USD BLUE") ||
            (moneda === "USD" && cuentaCorriente === "USD OFICIAL")
          ) {
            tipoDeCambio = 1;
          } else if (moneda === "ARS" && cuentaCorriente === "USD BLUE") {
            tipoDeCambio = blue.venta;
          } else if (moneda === "ARS" && cuentaCorriente === "USD OFICIAL") {
            tipoDeCambio = oficial.venta;
          } else if (moneda === "USD" && cuentaCorriente === "ARS") {
            tipoDeCambio = blue.venta;
          } else {
            tipoDeCambio = 1;
          }
        }
      }
      movimientoData.tipoDeCambio = tipoDeCambio;

      if (type === "EGRESO") {
        movimientoData.total = {
          ars: montoEnviado,
          usdOficial: montoEnviado,
          usdBlue: montoEnviado,
        };
      } else if (moneda === "ARS") {
        movimientoData.total = {
          ars: montoEnviado,
          usdOficial: calcular
            ? montoEnviado / oficial.venta
            : movimientoData?.montoTEST,
          usdBlue: calcular
            ? montoEnviado / blue.venta
            : movimientoData?.montoTEST,
        };
      } else if (moneda === "USD") {
        movimientoData.total = {
          ars: calcular ? montoEnviado * blue.venta : movimientoData?.montoTEST,
          usdOficial: montoEnviado,
          usdBlue: montoEnviado,
        };
      }

      // Normalizar fechaFactura: si no es Date válida, no enviar el campo
      if (
        movimientoData.fechaFactura !== undefined &&
        movimientoData.fechaFactura !== null
      ) {
        if (movimientoData.fechaFactura instanceof Date) {
          if (isNaN(movimientoData.fechaFactura.getTime())) {
            delete movimientoData.fechaFactura;
          }
        } else if (
          typeof movimientoData.fechaFactura === "string" ||
          typeof movimientoData.fechaFactura === "number"
        ) {
          const parsed = new Date(movimientoData.fechaFactura);
          if (!isNaN(parsed.getTime())) {
            movimientoData.fechaFactura = parsed;
          } else {
            delete movimientoData.fechaFactura;
          }
        } else {
          delete movimientoData.fechaFactura;
        }
      }
      if (cuentaCorriente === "ARS") {
        movimientoData.camposBusqueda =
          movimientoData.camposBusqueda +
          " " +
          Math.round(movimientoData.total.ars);
      } else if (cuentaCorriente === "USD BLUE") {
        movimientoData.camposBusqueda =
          movimientoData.camposBusqueda +
          " " +
          Math.round(movimientoData.total.usdBlue);
      } else if (cuentaCorriente === "USD OFICIAL") {
        movimientoData.camposBusqueda =
          movimientoData.camposBusqueda +
          " " +
          Math.round(movimientoData.total.usdOficial);
      }

      console.log("Cargando camposBusqueda");
      const cuentaDestino = movimientoData.caja
        ? await Caja.findById(movimientoData.caja)
        : "Sin caja";
      const montoCC =
        movimientoData.cuentaCorriente === "ARS"
          ? movimientoData.total.ars
          : movimientoData.total.usdBlue;

      const camposBusqueda = `${movimientoData?.cliente?.nombre} ${
        cuentaDestino?.nombre || ""
      } ${movimientoData.cuentaCorriente} ${movimientoData.moneda} ${
        movimientoData.tipoDeCambio
      } ${Math.round(montoEnviado)} ${movimientoData.nombreUsuario} ${
        movimientoData.estado
      } ${Math.round(montoCC)}`;

      console.log("camposBusqueda", camposBusqueda);
      movimientoData.camposBusqueda = camposBusqueda;

      const movimiento = await this.create({
        ...movimientoData,
        empresaId: movimientoData.empresaId || "celulandia",
      });

      if (movimiento?.success && movimiento?.data?._id) {
        const populated = await this.model
          .findById(movimiento.data._id)
          .populate("caja");
        if (saveToSheet) {
          console.log("TODO");
        }
      }

      return movimiento;
    } catch (error) {
      return { success: false, error: error };
    }
  }

  async updateMovimiento(id, movimientoData) {
    try {
      const movimientoActual = await this.model.findById(id);
      if (!movimientoActual) {
        return { success: false, error: "Movimiento no encontrado" };
      }

      const cambiaronTcOMonto =
        movimientoData.montoEnviado !== undefined ||
        movimientoData.tipoDeCambio !== undefined;

      // Si solo cambió la caja y no hay otros cambios, no recalcular totales
      const soloCambioCaja =
        movimientoData.caja !== undefined &&
        !cambiaronTcOMonto &&
        Object.keys(movimientoData).length === 1;

      // Cotizaciones disponibles para cálculos automáticos
      const cotizaciones = await DolarService.obtenerValoresDolar();
      const { blue, oficial } = cotizaciones;

      const { moneda, type, cuentaCorriente } = movimientoActual;

      // Determinar tipo de cambio a usar (manual si vino, sino automático)
      const tcAuto = () => {
        if (
          (moneda === "ARS" && cuentaCorriente === "ARS") ||
          (moneda === "USD" &&
            (cuentaCorriente === "USD BLUE" ||
              cuentaCorriente === "USD OFICIAL"))
        )
          return 1;
        if (moneda === "ARS" && cuentaCorriente === "USD BLUE")
          return blue.venta;
        if (moneda === "ARS" && cuentaCorriente === "USD OFICIAL")
          return oficial.venta;
        if (moneda === "USD" && cuentaCorriente === "ARS") return blue.venta;
        return movimientoActual.tipoDeCambio || 1;
      };

      let tipoDeCambio =
        movimientoData.tipoDeCambio !== undefined
          ? Number(movimientoData.tipoDeCambio)
          : tcAuto();

      // Reconstruir monto base si no vino explícito
      let montoBase =
        movimientoData.montoEnviado !== undefined
          ? Number(movimientoData.montoEnviado)
          : moneda === "ARS"
          ? movimientoActual.total?.ars || 0
          : movimientoActual.total?.usdBlue ||
            movimientoActual.total?.usdOficial ||
            0;

      if (cambiaronTcOMonto && !soloCambioCaja) {
        let nuevosTotales;

        if (type === "EGRESO") {
          const montoOriginal = movimientoActual.total?.ars || 0;
          const signo = montoOriginal < 0 ? -1 : 1;
          const montoAbsoluto = Math.abs(montoBase);

          nuevosTotales = {
            ars: montoAbsoluto * signo,
            usdOficial: montoAbsoluto * signo,
            usdBlue: montoAbsoluto * signo,
          };
        } else if (moneda === "ARS") {
          // Si vino TC manual y CC es USD, usarlo para esa CC; el resto automático
          const usdOficial =
            cuentaCorriente === "USD OFICIAL" &&
            movimientoData.tipoDeCambio !== undefined
              ? montoBase / tipoDeCambio
              : montoBase / oficial.venta;

          const usdBlue =
            cuentaCorriente === "USD BLUE" &&
            movimientoData.tipoDeCambio !== undefined
              ? montoBase / tipoDeCambio
              : montoBase / blue.venta;

          nuevosTotales = {
            ars: montoBase,
            usdOficial,
            usdBlue,
          };
        } else if (moneda === "USD") {
          const ars =
            cuentaCorriente === "ARS" &&
            movimientoData.tipoDeCambio !== undefined
              ? montoBase * tipoDeCambio
              : montoBase * blue.venta;

          nuevosTotales = {
            ars,
            usdBlue: montoBase,
            usdOficial: montoBase,
          };
        }

        movimientoData.total = nuevosTotales;
        movimientoData.tipoDeCambio = tipoDeCambio;
      }

      if (movimientoData.caja) {
        const caja = await Caja.findById(movimientoData.caja);
        if (!caja) return { success: false, error: "Caja no encontrada" };
      }

      const { nombreUsuario, ...datosMovimiento } = movimientoData;
      const updateData = { ...datosMovimiento, nombreUsuario };

      return await this.update(id, updateData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async actualizarEstados(ids, usuario, estado = "CONFIRMADO") {
    const response = await this.model.updateMany(
      { _id: { $in: ids } },
      { $set: { estado: estado } }
    );
    return response;
  }

  async getByCliente(clienteId, includeInactive = false) {
    try {
      const filters = { clienteId: clienteId };
      if (!includeInactive) {
        filters.active = true;
      }

      const movimientos = await this.model
        .find(filters)
        .populate("cliente")
        .populate("caja")
        .sort({ fechaFactura: -1 });
      return { success: true, data: movimientos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getByCaja(cajaId, includeInactive = false) {
    try {
      const filters = { caja: cajaId };
      if (!includeInactive) {
        filters.active = true;
      }

      const movimientos = await this.model
        .find(filters)
        .populate("cliente")
        .populate("caja")
        .sort({ fechaFactura: -1 });
      return { success: true, data: movimientos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getByType(type, includeInactive = false) {
    try {
      const filters = { type };
      if (!includeInactive) {
        filters.active = true;
      }

      const movimientos = await this.model
        .find(filters)
        .populate("cliente")
        .populate("caja")
        .sort({ fechaFactura: -1 });
      return { success: true, data: movimientos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getByFechaRange(fechaInicio, fechaFin, includeInactive = false) {
    try {
      const filters = {
        fechaFactura: {
          $gte: new Date(fechaInicio),
          $lte: new Date(fechaFin),
        },
      };

      if (!includeInactive) {
        filters.active = true;
      }

      const movimientos = await this.model
        .find(filters)
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

      const movimientos = await this.model
        .find({ active: true })
        .populate("cliente");

      const cuentasResp =
        await CuentaPendienteController.getByProveedorOCliente("");
      const cuentasPendientes = cuentasResp?.success ? cuentasResp.data : [];

      const clientesTotales = clientes.map((cliente) => {
        const movimientosCliente = movimientos.filter(
          (mov) =>
            mov.clienteId && mov.clienteId.toString() === cliente._id.toString()
        );

        const cuentasPendientesCliente = cuentasPendientes.filter((cuenta) => {
          if (!cuenta?.cliente) return false;
          try {
            return cuenta.cliente.toString() === cliente._id.toString();
          } catch (e) {
            return false;
          }
        });

        let totalARS = 0;
        let totalUSDBlue = 0;
        let totalUSDOficial = 0;
        let fechaUltimoPago = null;
        let fechaUltimaEntrega = null;

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

          if (mov.type === "INGRESO") {
            if (!fechaUltimoPago || mov.fechaFactura > fechaUltimoPago) {
              fechaUltimoPago = mov.fechaFactura;
            }
          }
        });

        cuentasPendientesCliente.forEach((cuenta) => {
          const fechaCuenta = cuenta?.fechaCuenta;
          if (fechaCuenta) {
            if (!fechaUltimaEntrega || fechaCuenta > fechaUltimaEntrega) {
              fechaUltimaEntrega = fechaCuenta;
            }
          }
          // Sumar montos de cuentas pendientes por CC usando montoTotal
          const cc = cuenta?.cc;
          const monto = cuenta?.montoTotal || {};
          if (cc === "ARS") {
            totalARS += Number(monto.ars || 0);
          } else if (cc === "USD BLUE") {
            totalUSDBlue += Number(monto.usdBlue || 0);
          } else if (cc === "USD OFICIAL") {
            totalUSDOficial += Number(monto.usdOficial || 0);
          }
        });

        // Totales ya incluyen cuentas pendientes por cliente a partir de su ObjectId

        return {
          _id: cliente._id,
          cliente: cliente.nombre,
          ARS: totalARS,
          "USD BLUE": totalUSDBlue,
          "USD OFICIAL": totalUSDOficial,
          fechaUltimoPago: fechaUltimoPago,
          fechaUltimaEntrega: fechaUltimaEntrega,
        };
      });

      clientesTotales.sort((a, b) => a.cliente.localeCompare(b.cliente));

      return { success: true, data: clientesTotales };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTotalByType(type, includeInactive = false) {
    try {
      const match = { type };
      if (!includeInactive) {
        match.active = true;
      }

      const result = await this.model.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]);
      const total = result.length > 0 ? result[0].total : 0;
      return { success: true, data: total };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getEstadisticas(includeInactive = false) {
    try {
      const filters = {};
      if (!includeInactive) {
        filters.active = true;
      }

      const totalMovimientos = await this.model.countDocuments(filters);
      const totalIngresos = await this.getTotalByType(
        "INGRESO",
        includeInactive
      );
      const totalEgresos = await this.getTotalByType("EGRESO", includeInactive);
      const movimientosPorTipo = await this.model.aggregate([
        { $match: filters },
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

  async getArqueoTotal() {
    try {
      const cajaEfectivo = await Caja.findOne({ nombre: "EFECTIVO" });
      if (!cajaEfectivo) {
        return {
          success: false,
          error: "No se encontró la caja EFECTIVO",
        };
      }

      const pipeline = [
        {
          $match: {
            active: true,
            caja: cajaEfectivo._id,
          },
        },
        {
          $group: {
            _id: null,
            totalARS: {
              $sum: {
                $cond: [{ $eq: ["$moneda", "ARS"] }, "$total.ars", 0],
              },
            },
            totalUSD: {
              $sum: {
                $cond: [{ $eq: ["$moneda", "USD"] }, "$total.usdBlue", 0],
              },
            },
            totalMovimientos: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            totalARS: { $round: ["$totalARS", 2] },
            totalUSD: { $round: ["$totalUSD", 2] },
            totalMovimientos: 1,
          },
        },
      ];

      const result = await this.model.aggregate(pipeline);

      if (result.length === 0) {
        return {
          success: true,
          data: {
            totalARS: 0,
            totalUSD: 0,
            totalMovimientos: 0,
          },
        };
      }

      return {
        success: true,
        data: result[0],
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getArqueoDiario(options = {}) {
    try {
      const match = { active: true, ...options.filter } || { active: true };

      // Proyección para calcular monto enviado por moneda
      const pipeline = [
        { $match: match },
        {
          $project: {
            fecha: { $ifNull: ["$fechaFactura", "$fechaCreacion"] },
            moneda: 1,
            cuentaCorriente: 1,
            total: 1,
            montoARS: {
              $cond: [{ $eq: ["$moneda", "ARS"] }, "$total.ars", 0],
            },
            montoUSD: {
              $cond: [
                { $eq: ["$moneda", "USD"] },
                {
                  $cond: [
                    { $eq: ["$cuentaCorriente", "USD BLUE"] },
                    "$total.usdBlue",
                    "$total.usdOficial",
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$fecha" },
            },
            totalARS: { $sum: "$montoARS" },
            totalUSD: { $sum: "$montoUSD" },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            fecha: "$_id",
            totalARS: { $ifNull: ["$totalARS", 0] },
            totalUSD: { $ifNull: ["$totalUSD", 0] },
          },
        },
      ];

      const data = await this.model.aggregate(pipeline);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async delete(id, nombreUsuario) {
    try {
      if (!nombreUsuario) {
        return {
          success: false,
          error: "El nombreUsuario es requerido para los logs",
        };
      }

      const movimiento = await this.model.findById(id);
      if (!movimiento) {
        return { success: false, error: "Movimiento no encontrado" };
      }

      if (!movimiento.active) {
        return { success: false, error: "El movimiento ya está eliminado" };
      }

      const updateData = {
        active: false,
        nombreUsuario: nombreUsuario,
      };

      const result = await this.model.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getSumTotalByMoneda(moneda, cajaId = null) {
    const matchFilter = { active: true, moneda };

    if (cajaId) {
      matchFilter.caja = cajaId;
    }

    const result = await this.model.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $eq: ["$moneda", "ARS"] },
                "$total.ars",
                "$total.usdBlue",
              ],
            },
          },
        },
      },
    ]);
    console.log("resultTotal", result);
    return result.length > 0 ? result[0].total : 0;
  }

  async migrarBusqueda() {
    try {
      const docs = await this.model.find(query).populate("caja");

      let updated = 0;
      for (const doc of docs) {
        const clienteNombre = (doc?.cliente?.nombre || "").toString();
        const cajaNombre = (doc?.caja?.nombre || "").toString();
        const cuentaCorriente = (doc?.cuentaCorriente || "").toString();
        const moneda = (doc?.moneda || "").toString();
        const estado = (doc?.estado || "").toString();
        const usuario = (doc?.nombreUsuario || "").toString();
        const tipoDeCambio = Math.round(Number(doc?.tipoDeCambio || 0));

        const total = doc?.total || {};
        const montoCC = (() => {
          if (cuentaCorriente === "ARS")
            return Math.round(Number(total.ars || 0));
          if (cuentaCorriente === "USD BLUE")
            return Math.round(Number(total.usdBlue || 0));
          if (cuentaCorriente === "USD OFICIAL")
            return Math.round(Number(total.usdOficial || 0));
          return 0;
        })();

        const montoEnviado = (() => {
          if (moneda === "ARS") return Math.round(Number(total.ars || 0));
          if (moneda === "USD") {
            const usdVal =
              total.usdBlue !== undefined && total.usdBlue !== null
                ? total.usdBlue
                : total.usdOficial;
            return Math.round(Number(usdVal || 0));
          }
          return 0;
        })();

        const camposBusqueda = [
          clienteNombre,
          cajaNombre,
          cuentaCorriente,
          moneda,
          estado,
          usuario,
          String(tipoDeCambio),
          String(montoCC),
          String(montoEnviado),
        ]
          .filter(
            (v) => v !== undefined && v !== null && String(v).trim().length > 0
          )
          .join(" ");

        await this.model.findByIdAndUpdate(
          doc._id,
          { camposBusqueda },
          { new: false }
        );
        updated += 1;
      }

      return { success: true, data: { updated, total: docs.length } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MovimientoController();
