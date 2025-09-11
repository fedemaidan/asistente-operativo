const BaseController = require("./baseController");
const Cliente = require("../models/cliente.model");
const mongoose = require("mongoose");
const Movimiento = require("../models/movimiento.model");
const CuentaPendiente = require("../models/cuentaPendiente.model");

class ClienteController extends BaseController {
  constructor() {
    super(Cliente);
  }

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

  /**
   * Devuelve la cuenta corriente del cliente (movimientos + cuentas pendientes)
   * ya parseada, ordenada por fecha y con columnas Debe/Haber/Saldo acumulado
   * calculadas por grupo de cuenta corriente (ARS, USD BLUE, USD OFICIAL).
   *
   * Params soportados en options:
   * - includeInactive: boolean (default false)
   * - sortDirection: 'asc' | 'desc' (default 'desc' para la vista)
   * - fechaInicio, fechaFin: ISO strings (opcional)
   * - group: si se desea filtrar por una CC específica (opcional)
   */
  async getClienteCCComputed(id, options = {}) {
    try {
      const {
        includeInactive = false,
        sortDirection = "desc",
        fechaInicio,
        fechaFin,
        group,
      } = options;

      const cliente = await Cliente.findById(id).lean();
      if (!cliente) {
        return { success: false, error: "Cliente no encontrado" };
      }

      const dir = sortDirection === "asc" ? 1 : -1;

      // Filtros de fecha (se aplican en MEMORIA, no en la BD)
      const dateStart = fechaInicio ? new Date(fechaInicio) : null;
      const dateEnd = fechaFin ? new Date(fechaFin) : null;

      // MOVIMIENTOS por clienteId
      const movQuery = {
        clienteId: id,
      };
      let movimientosRaw = await Movimiento.find(movQuery).lean();
      if (!includeInactive) {
        movimientosRaw = movimientosRaw.filter((m) => m?.active !== false);
      }

      // CUENTAS PENDIENTES: SIEMPRE por referencia directa al cliente (solo por ID)
      const cuentasQuery = {
        cliente: id,
      };
      let cuentasRaw = await CuentaPendiente.find(cuentasQuery).lean();
      if (!includeInactive) {
        cuentasRaw = cuentasRaw.filter((c) => c?.active !== false);
      }

      // Helpers idénticos al frontend
      const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
      const getTimeSafe = (v) => {
        if (!v) return 0;
        const d = new Date(v);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };

      // Parseo idéntico al frontend pero preservando fecha ISO cruda para ordenar
      const parsedMovs = movimientosRaw
        .filter((m) => m.type === "INGRESO")
        .map((raw) => {
          const p = this.parseMovimiento(raw);
          const fecha = raw.fechaFactura || raw.fechaCreacion || null; // ISO
          const monto = round2(toNumber(p.montoCC || 0));
          const tc = toNumber(p.tipoDeCambio || 1);
          const montoOriginalBase = round2(toNumber(p.montoEnviado || 0));
          const montoOriginal =
            montoOriginalBase === 0 ? round2(monto * tc) : montoOriginalBase;
          return {
            id: p.id || p._id || raw._id,
            fecha,
            descripcion: p.numeroFactura || raw.numeroFactura || raw._id,
            cliente:
              p?.nombreCliente || p?.clienteNombre || p?.cliente?.nombre || "-",
            group: p.cuentaCorriente || p.CC || p.cc,
            monto,
            montoCC: monto,
            tipoDeCambio: tc,
            descuentoAplicado: p.descuentoAplicado,
            montoOriginal,
            monedaOriginal: p.moneda || p.monedaDePago,
            urlImagen: p?.urlImagen || raw?.urlImagen || null,
            itemType: "movimiento",
          };
        });

      const parsedCuentas = cuentasRaw.map((raw) => {
        const p = this.parseCuentaPendiente(raw);
        const fecha = raw.fechaCuenta || null; // ISO
        const monto = round2(toNumber(p.montoCC || 0));
        const tc = toNumber(p.tipoDeCambio || 1);
        const montoOriginalBase = round2(toNumber(p.montoEnviado || 0));
        const montoOriginal =
          montoOriginalBase === 0 ? round2(monto * tc) : montoOriginalBase;
        return {
          id: p.id || p._id || raw._id,
          fecha,
          descripcion: p.descripcion || raw.descripcion || "-",
          cliente:
            p?.nombreCliente ||
            p?.clienteNombre ||
            p?.cliente?.nombre ||
            p?.proveedorOCliente ||
            "-",
          group: p.cuentaCorriente || p.CC || p.cc,
          monto,
          montoCC: monto,
          tipoDeCambio: tc,
          descuentoAplicado: p.descuentoAplicado,
          montoOriginal,
          monedaOriginal: p.monedaDePago || p.moneda,
          urlImagen: null,
          itemType: "cuentaPendiente",
        };
      });

      // Unificar
      let items = [...parsedMovs, ...parsedCuentas];

      // Filtros en memoria EXACTAMENTE como en el frontend
      if (group) {
        items = items.filter((it) => (it.group || "") === group);
      }
      if (dateStart || dateEnd) {
        items = items.filter((it) => {
          const t = getTimeSafe(it.fecha);
          if (dateStart && t < dateStart.getTime()) return false;
          if (dateEnd && t > dateEnd.getTime()) return false;
          return true;
        });
      }

      // Calcular Debe/Haber/Saldo por grupo (igual que DataTabTable + agregarSaldoCalculado)
      const groupsMap = new Map();
      for (const it of items) {
        const g = it.group || "DEFAULT";
        if (!groupsMap.has(g)) groupsMap.set(g, []);
        groupsMap.get(g).push(it);
      }

      const withSaldoAsc = [];
      for (const [g, arr] of groupsMap.entries()) {
        const asc = [...arr].sort(
          (a, b) => getTimeSafe(a.fecha) - getTimeSafe(b.fecha)
        );
        let running = 0;
        for (const row of asc) {
          const baseMonto = row?.montoCC != null ? row.montoCC : row?.monto;
          const monto = toNumber(baseMonto);
          const debe =
            row?.debe != null
              ? toNumber(row.debe)
              : monto < 0
              ? Math.abs(monto)
              : 0;
          const haber =
            row?.haber != null ? toNumber(row.haber) : monto > 0 ? monto : 0;
          running = round2(running + (haber - debe));
          withSaldoAsc.push({
            ...row,
            debe: toNumber(debe),
            haber: toNumber(haber),
            saldoAcumulado: toNumber(running),
          });
        }
      }

      // Orden final según sortDirection requerido por la vista
      const final = withSaldoAsc.sort((a, b) =>
        dir === 1
          ? getTimeSafe(a.fecha) - getTimeSafe(b.fecha)
          : getTimeSafe(b.fecha) - getTimeSafe(a.fecha)
      );

      return {
        success: true,
        data: final,
        total: final.length,
        sortField: "fecha",
        sortDirection,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateCliente(id, clienteData) {
    try {
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

  async getClienteCCById(id, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        sortDirection = "desc", // solo usamos fecha; 'asc' | 'desc'
        fechaInicio,
        fechaFin,
        includeInactive = false,
        group, // 'ARS' | 'USD BLUE' | 'USD OFICIAL' (opcional)
      } = options;

      const cli = await Cliente.findById(id).lean();
      if (!cli) return { success: false, error: "Cliente no encontrado" };
      const clienteNombre = (cli.nombre || "").toString().trim().toLowerCase();

      const dir = sortDirection === "asc" ? 1 : -1;

      // Filtros comunes
      const dateStart = fechaInicio ? new Date(fechaInicio) : null;
      const dateEnd = fechaFin ? new Date(fechaFin) : null;

      const movMatch = {
        clienteId: new mongoose.Types.ObjectId(id),
        ...(includeInactive ? {} : { active: true }),
        ...(group ? { cuentaCorriente: group } : {}),
      };

      const cuentasMatch = {
        ...(includeInactive ? {} : { active: true }),
        ...(group ? { cc: group } : {}),
        $expr: {
          $eq: [
            { $toLower: { $trim: { input: "$proveedorOCliente" } } },
            clienteNombre,
          ],
        },
      };

      const movimientosPipeline = [
        { $match: movMatch },
        ...(dateStart || dateEnd
          ? [
              {
                $match: {
                  $expr: {
                    $and: [
                      ...(dateStart
                        ? [{ $gte: ["$fechaFactura", dateStart] }]
                        : []),
                      ...(dateEnd
                        ? [{ $lte: ["$fechaFactura", dateEnd] }]
                        : []),
                    ],
                  },
                },
              },
            ]
          : []),
        {
          $addFields: {
            itemType: "movimiento",
            fechaOrden: "$fechaFactura",
          },
        },
      ];

      const cuentasPipeline = [
        { $match: cuentasMatch },
        ...(dateStart || dateEnd
          ? [
              {
                $match: {
                  fechaCuenta: {
                    ...(dateStart ? { $gte: dateStart } : {}),
                    ...(dateEnd ? { $lte: dateEnd } : {}),
                  },
                },
              },
            ]
          : []),
        {
          $addFields: {
            itemType: "cuentaPendiente",
            fechaOrden: "$fechaCuenta",
          },
        },
      ];

      const pipeline = [
        ...movimientosPipeline,
        {
          $unionWith: {
            coll: CuentaPendiente.collection.name,
            pipeline: cuentasPipeline,
          },
        },
        { $sort: { fechaOrden: dir, _id: dir } },
        {
          $facet: {
            data: [{ $skip: offset }, { $limit: Number(limit) }],
            meta: [{ $count: "total" }],
          },
        },
      ];

      const agg = await Movimiento.aggregate(pipeline);
      const data = agg[0]?.data || [];
      const total = agg[0]?.meta?.[0]?.total || 0;

      return {
        success: true,
        data,
        total,
        limit,
        offset,
        sortField: "fecha",
        sortDirection,
        group: group || null,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  parseMovimiento(movimiento) {
    let montoCC = 0;
    switch (movimiento.cuentaCorriente) {
      case "ARS":
        montoCC = movimiento.total.ars;
        break;
      case "USD BLUE":
        montoCC = movimiento.total.usdBlue;
        break;
      case "USD OFICIAL":
        montoCC = movimiento.total.usdOficial;
        break;
    }

    let montoEnviado = 0;

    switch (movimiento.moneda) {
      case "ARS":
        montoEnviado = movimiento.total.ars;
        break;
      case "USD":
        if (movimiento.cuentaCorriente === "USD BLUE") {
          montoEnviado = movimiento.total.usdBlue;
        } else if (movimiento.cuentaCorriente === "USD OFICIAL") {
          montoEnviado = movimiento.total.usdOficial;
        } else if (movimiento.cuentaCorriente === "ARS") {
          montoEnviado = movimiento.total.usdBlue;
        }
        break;
    }

    let fechaFactura = null;
    let horaCreacion = null;

    if (movimiento?.fechaFactura) {
      fechaFactura = this.getFechaArgentina(movimiento.fechaFactura);
    }

    if (movimiento?.fechaCreacion) {
      horaCreacion = this.getHoraArgentina(movimiento.fechaCreacion);
    }

    return {
      ...movimiento.toObject(),
      montoEnviado,
      tipoDeCambio: Math.round(movimiento.tipoDeCambio),
      montoCC: Math.round(montoCC),
      fechaCreacion: movimiento.fechaCreacion,
      fechaFactura,
      horaCreacion,
      nombreCliente: movimiento.cliente?.nombre || "Sin cliente",
      ccActivasCliente: movimiento.cliente?.ccActivas || [],
      cuentaDestino: movimiento.caja?.nombre || "Sin caja",
      type: "movimiento",
      itemType: "movimiento",
    };
  }

  parseCuentaPendiente(cuenta) {
    const fechaCuentaCompleta = new Date(cuenta.fechaCuenta);
    const hora = fechaCuentaCompleta.toTimeString().split(" ")[0]; // HH:MM:SS
    const cc = cuenta.cc;
    let montoCC = 0;
    if (cc === "ARS") montoCC = Number(cuenta?.montoTotal?.ars || 0);
    else if (cc === "USD BLUE")
      montoCC = Number(cuenta?.montoTotal?.usdBlue || 0);
    else if (cc === "USD OFICIAL")
      montoCC = Number(cuenta?.montoTotal?.usdOficial || 0);

    let montoEnviado;

    switch (cuenta.moneda) {
      case "ARS":
        montoEnviado = Number(cuenta?.subTotal?.ars || 0);
        break;
      case "USD":
        montoEnviado = Number(cuenta?.subTotal?.usdBlue || 0);
        break;
    }

    return {
      ...cuenta.toObject(),
      id: cuenta._id,
      _id: cuenta._id,
      origen: "cuentaPendiente",
      numeroComprobante: cuenta.descripcion || "-",
      fecha: this.getFechaArgentina(cuenta.fechaCuenta),
      hora,
      montoCC,
      tipoDeCambio: cuenta.tipoDeCambio || 1,
      montoEnviado,
      monedaDePago: cuenta.moneda,
      cuentaDestino: cuenta.cc,
      estado: "-",
      type: "EGRESO",
      cuentaCorriente: cuenta.cc,
      proveedorOCliente: cuenta.proveedorOCliente,
      descripcion: cuenta.descripcion,
      CC: cuenta.cc,
      descuentoAplicado: cuenta.descuentoAplicado,
      type: "cuentaPendiente",
      itemType: "cuentaPendiente",
    };
  }

  getFechaArgentina(fecha) {
    if (!fecha) return null;
    try {
      const date = new Date(fecha);
      if (isNaN(date.getTime())) {
        return fecha;
      }
      return date.toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
      });
    } catch (error) {
      return fecha;
    }
  }

  getHoraArgentina(fecha) {
    if (!fecha) return null;
    try {
      const date = new Date(fecha);
      if (isNaN(date.getTime())) {
        return fecha;
      }
      return date.toLocaleTimeString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (error) {
      return fecha;
    }
  }
}

module.exports = new ClienteController();
