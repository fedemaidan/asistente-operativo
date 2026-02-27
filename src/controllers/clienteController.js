const BaseController = require("./baseController");
const Cliente = require("../models/cliente.model");
const mongoose = require("mongoose");
const Movimiento = require("../models/movimiento.model");
const CuentaPendiente = require("../models/cuentaPendiente.model");
const {
  syncClienteToAltSheet,
  updateClienteInAltSheetByName,
  updateClienteCuentasActivasInAltSheet,
  deleteClienteFromAltSheet,
} = require("../Utiles/GoogleServices/Sheets/clienteAlternativo");

const formatFechaArgentina = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    return value;
  }
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
  } catch (error) {
    return value;
  }
};

const extractTimeFromValue = (value) => {
  if (!value) return null;
  const raw = typeof value === "string" ? value : value?.toISOString?.() ?? "";
  if (!raw) return null;
  const parts = raw.split("T");
  if (parts.length < 2) return null;
  return parts[1].split(":").slice(0, 2).join(":");
};

const buildFechaFacturaISO = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const dateObj = new Date(value);
    if (isNaN(dateObj.getTime())) {
      return value;
    }
    const randomSeconds = Math.floor(Math.random() * 60);
    dateObj.setSeconds(randomSeconds);
    return dateObj.toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

class ClienteController extends BaseController {
  constructor() {
    super(Cliente);
  }

  async createCliente(clienteData, options = {}) {
    try {
      const { syncToSheet = true } = options;
      // Validar que el nombre sea único
      const existingCliente = await this.model.findOne({
        nombre: clienteData.nombre,
      });

      if (existingCliente) {
        return { success: false, error: "Ya existe un cliente con ese nombre" };
      }

      const result = await this.create(clienteData);
      if (result?.success && result?.data && syncToSheet) {
        await syncClienteToAltSheet(result.data);
      }
      return result;
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
        sortField = "fechaEntrega",
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

      // Helpers idénticos al frontend
      const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
      const getTimeSafe = (v) => {
        if (!v) return 0;
        const d = new Date(v);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };

      // Filtros de fecha (se aplican en MEMORIA, igual que estaba)
      const dateStart = fechaInicio ? new Date(fechaInicio) : null;
      const dateEnd = fechaFin ? new Date(fechaFin) : null;

      // MOVIMIENTOS por clienteId
      const movQuery = { clienteId: id };
      let movimientosRaw = await Movimiento.find(movQuery).lean();
      if (!includeInactive) movimientosRaw = movimientosRaw.filter((m) => m?.active !== false);

      // CUENTAS PENDIENTES por referencia de cliente (mismo criterio que la vista actual)
      const cuentasQuery = { cliente: id };
      let cuentasRaw = await CuentaPendiente.find(cuentasQuery).lean();
      if (!includeInactive) cuentasRaw = cuentasRaw.filter((c) => c?.active !== false);

      // Parseo alineado con la pantalla actual
      const parsedMovs = movimientosRaw
        .filter((m) => m.type === "INGRESO")
        .map((raw) => {
          const montoCC =
            raw.cuentaCorriente === "ARS"
              ? toNumber(raw?.total?.ars || 0)
              : raw.cuentaCorriente === "USD BLUE"
              ? toNumber(raw?.total?.usdBlue || 0)
              : toNumber(raw?.total?.usdOficial || 0);

          const montoEnviado =
            raw.moneda === "ARS"
              ? toNumber(raw?.total?.ars || 0)
              : raw.cuentaCorriente === "USD OFICIAL"
              ? toNumber(raw?.total?.usdOficial || 0)
              : toNumber(raw?.total?.usdBlue || 0);

          const monto = round2(montoCC);
          const tc = toNumber(raw?.tipoDeCambio || 1);
          const montoOriginalAbs =
            montoEnviado !== 0
              ? Math.abs(round2(montoEnviado))
              : Math.abs(round2(monto * tc));
          const fechaFacturaRaw = raw?.fechaFactura || null;
          const fechaCreacionRaw = raw?.fechaCreacion || null;
          const fechaFacturaParsed = formatFechaArgentina(fechaFacturaRaw);
          const fechaFacturaISO = buildFechaFacturaISO(fechaFacturaRaw);
          const fechaEntrega = fechaFacturaRaw || fechaCreacionRaw || null;
          const fechaOrden = fechaFacturaISO || fechaCreacionRaw || null;
          const horaFactura = extractTimeFromValue(fechaFacturaRaw);
          const horaCreacion = extractTimeFromValue(fechaCreacionRaw);

          return {
            id: String(raw?._id),
            _id: raw?._id,
            fecha: fechaOrden,
            fechaCreacion: fechaCreacionRaw,
            horaCreacion,
            horaFactura,
            fechaFactura: fechaFacturaParsed,
            fechaEntrega,
            descripcion:
              raw?.concepto && raw?.concepto !== "-"
                ? raw.concepto
                : raw?.descripcion
                ? raw.descripcion
                : "-",
            cliente: raw?.cliente?.nombre || "-",
            group: raw?.cuentaCorriente || null,
            monto,
            montoCC: monto,
            tipoDeCambio: tc,
            descuentoAplicado: raw?.descuentoAplicado,
            montoOriginal: montoOriginalAbs,
            monedaOriginal: raw?.moneda || "ARS",
            montoYMonedaOriginal: {
              monto: montoOriginalAbs,
              moneda: raw?.moneda || "ARS",
            },
            urlImagen: raw?.urlImagen || null,
            itemType: "movimiento",
            originalData: raw,
          };
        });

      const parsedCuentas = cuentasRaw.map((raw) => {
        const montoCC =
          raw.cc === "ARS"
            ? toNumber(raw?.montoTotal?.ars || 0)
            : raw.cc === "USD BLUE"
            ? toNumber(raw?.montoTotal?.usdBlue || 0)
            : toNumber(raw?.montoTotal?.usdOficial || 0);

        const montoEnviado =
          raw.moneda === "ARS"
            ? toNumber(raw?.subTotal?.ars || 0)
            : toNumber(raw?.subTotal?.usdBlue || 0);

        const monto = round2(montoCC);
        const tc = toNumber(raw?.tipoDeCambio || 1);
        const montoOriginalAbs =
          montoEnviado !== 0
            ? Math.abs(round2(montoEnviado))
            : Math.abs(round2(monto * tc));
        const shouldNegate = toNumber(raw?.descuentoAplicado) <= 1;
        const fechaEntrega = raw?.fechaCuenta || null;
        const fechaCreacionRaw = raw?.fechaCreacion || null;
        const horaCreacion = extractTimeFromValue(fechaCreacionRaw);

        return {
          id: String(raw?._id),
          _id: raw?._id,
          fecha: fechaEntrega,
          fechaCreacion: fechaCreacionRaw,
          horaCreacion,
          fechaEntrega,
          descripcion:
            raw?.concepto && raw?.concepto !== "-"
              ? raw.concepto
              : raw?.descripcion
              ? raw.descripcion
              : "-",
          cliente: raw?.cliente?.nombre || raw?.proveedorOCliente || "-",
          group: raw?.cc || null,
          monto,
          montoCC: monto,
          tipoDeCambio: tc,
          descuentoAplicado: raw?.descuentoAplicado,
          montoOriginal: shouldNegate ? -montoOriginalAbs : montoOriginalAbs,
          monedaOriginal: raw?.moneda || "ARS",
          montoYMonedaOriginal: {
            monto: shouldNegate ? -montoOriginalAbs : montoOriginalAbs,
            moneda: raw?.moneda || "ARS",
          },
          urlImagen: null,
          itemType: "cuentaPendiente",
          originalData: raw,
        };
      });

      // Unificar
      let items = [...parsedMovs, ...parsedCuentas];

      // Filtros en memoria
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

      // Orden fijo de acumulación: mismo default de la vista (fechaEntrega DESC).
      // Luego se acumula en orden cronológico ASC de esa lista.
      const baseDesc = [...items].sort((a, b) => {
        const bt = getTimeSafe(b.fechaEntrega || b.fecha);
        const at = getTimeSafe(a.fechaEntrega || a.fecha);
        if (bt !== at) return bt - at;
        return String(b.id || "").localeCompare(String(a.id || ""));
      });

      // Calcular Debe/Haber/Saldo por grupo (misma regla que agregarSaldoCalculado)
      const groupsMap = new Map();
      for (const it of baseDesc) {
        const g = it.group || "DEFAULT";
        if (!groupsMap.has(g)) groupsMap.set(g, []);
        groupsMap.get(g).push(it);
      }

      const withSaldoById = new Map();
      for (const [g, arr] of groupsMap.entries()) {
        const asc = [...arr].reverse();
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
          withSaldoById.set(String(row.id), {
            debe: toNumber(debe),
            haber: toNumber(haber),
            saldoAcumulado: toNumber(running),
          });
        }
      }

      const withSaldo = baseDesc.map((row) => ({
        ...row,
        ...(withSaldoById.get(String(row.id)) || { debe: 0, haber: 0, saldoAcumulado: 0 }),
      }));

      const totalesCC = withSaldo.reduce(
        (acc, it) => {
          const key = it.group;
          if (key === "ARS") acc.ARS += toNumber(it.monto || 0);
          if (key === "USD BLUE") acc["USD BLUE"] += toNumber(it.monto || 0);
          if (key === "USD OFICIAL") acc["USD OFICIAL"] += toNumber(it.monto || 0);
          return acc;
        },
        { ARS: 0, "USD BLUE": 0, "USD OFICIAL": 0 }
      );

      // Orden de visualización opcional (el saldo NO se vuelve a calcular).
      const final = [...withSaldo].sort((a, b) =>
        dir === 1
          ? getTimeSafe(a.fechaEntrega || a.fecha) -
            getTimeSafe(b.fechaEntrega || b.fecha)
          : getTimeSafe(b.fechaEntrega || b.fecha) -
            getTimeSafe(a.fechaEntrega || a.fecha)
      );

      return {
        success: true,
        data: final,
        total: final.length,
        sortField,
        sortDirection,
        totalsCC: {
          ARS: round2(toNumber(totalesCC.ARS)),
          "USD BLUE": round2(toNumber(totalesCC["USD BLUE"])),
          "USD OFICIAL": round2(toNumber(totalesCC["USD OFICIAL"])),
        },
        accumulationOrder: {
          field: "fechaEntrega",
          direction: "desc",
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateCliente(id, clienteData) {
    try {
      const clienteOriginal = await this.model.findById(id).lean();
      if (!clienteOriginal) {
        return { success: false, error: "Cliente no encontrado" };
      }

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

      const result = await this.update(id, updateData);
      if (result?.success && result?.data) {
        await updateClienteInAltSheetByName(clienteOriginal.nombre, result.data);
      }
      return result;
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
      const result = await this.update(id, {
        ccActivas: cuentasActivas,
        usuario: usuario, // Se usa solo para los logs
      });
      if (result?.success) {
        await updateClienteCuentasActivasInAltSheet(
          clienteOriginal.nombre,
          cuentasActivas
        );
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteCliente(nombre) {
    try {
      if (!nombre || typeof nombre !== "string") {
        return { success: false, error: "Nombre de cliente inválido" };
      }
      const cliente = await this.model.findOne({ nombre });
      if (!cliente) {
        return { success: false, error: "Cliente no encontrado" };
      }
      await this.model.deleteOne({ _id: cliente._id });
      await deleteClienteFromAltSheet(nombre);
      return { success: true, data: { nombre, _id: cliente._id } };
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
