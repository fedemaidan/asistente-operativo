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
  async confirmMovimientos(ids = []) {
    return await this.activateMany(ids);
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

        if (moneda === "ARS") {
          movimientoData.total = {
            ars: montoEnviado,
            usdOficial: montoEnviado / oficial.venta,
            usdBlue: montoEnviado / blue.venta,
          };
        } else if (moneda === "USD") {
          movimientoData.total = {
            ars: montoEnviado * blue.venta,
            usdOficial: montoEnviado,
            usdBlue: montoEnviado,
          };
        } else {
          movimientoData.total = {
            ars: montoEnviado,
            usdOficial: montoEnviado,
            usdBlue: montoEnviado,
          };
        }
      try {
        let usdBalance =
          moneda === "USD"
            ? Number(montoEnviado || 0)
            : moneda === "ARS"
            ? Number(montoEnviado || 0) / Number(blue.venta || 1)
            : 0;
        usdBalance = type === "EGRESO" ? -Math.abs(usdBalance) : Math.abs(usdBalance);
        movimientoData.montoDolarBalance = Number(usdBalance.toFixed(2));
      } catch (_) {
        movimientoData.montoDolarBalance = 0;
      }
      } else if (moneda === "ARS") {
        movimientoData.total = {
          ars: montoEnviado,
          usdOficial: montoEnviado / oficial.venta,
          usdBlue: montoEnviado / blue.venta,
        };
      try {
        let usdBalance = Number(montoEnviado || 0) / Number(blue.venta || 1);
        usdBalance = type === "EGRESO" ? -Math.abs(usdBalance) : Math.abs(usdBalance);
        movimientoData.montoDolarBalance = Number(usdBalance.toFixed(2));
      } catch (_) {
        movimientoData.montoDolarBalance = 0;
      }
      } else if (moneda === "USD") {
        movimientoData.total = {
          ars: montoEnviado * blue.venta,
          usdOficial: montoEnviado,
          usdBlue: montoEnviado,
        };
      try {
        let usdBalance = Number(montoEnviado || 0);
        usdBalance = type === "EGRESO" ? -Math.abs(usdBalance) : Math.abs(usdBalance);
        movimientoData.montoDolarBalance = Number(usdBalance.toFixed(2));
      } catch (_) {
        movimientoData.montoDolarBalance = 0;
      }
      }

      const normalizedFechaFactura = BaseController.normalizeDateInput(
        movimientoData.fechaFactura
      );
      if (normalizedFechaFactura === undefined) {
        delete movimientoData.fechaFactura;
      } else {
        movimientoData.fechaFactura = normalizedFechaFactura;
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

  async createCompuesto(
    movimientoData1,
    montoEnviado1,
    movimientoData2,
    montoEnviado2,
    saveToSheet = true,
    calcular = true
  ) {
    try {
      // Crear primer movimiento
      const res1 = await this.createMovimiento(
        movimientoData1,
        montoEnviado1,
        saveToSheet,
        calcular
      );
      if (!res1?.success || !res1?.data?._id) {
        return {
          success: false,
          error:
            res1?.error ||
            "No se pudo crear el primer movimiento del compuesto",
        };
      }

      // Crear segundo movimiento
      const res2 = await this.createMovimiento(
        movimientoData2,
        montoEnviado2,
        saveToSheet,
        calcular
      );
      if (!res2?.success || !res2?.data?._id) {
        // Rollback del primero si falla el segundo
        try {
          await this.delete(res1.data._id, movimientoData1?.nombreUsuario || "Sistema");
        } catch (rbError) {
          console.error("Rollback fallido del primer movimiento:", rbError);
        }
        return {
          success: false,
          error:
            res2?.error ||
            "No se pudo crear el segundo movimiento del compuesto",
        };
      }

      const id1 = res1.data._id;
      const id2 = res2.data._id;

      // Enlazar ambos movimientos como complementarios
      const [upd1, upd2] = await Promise.all([
        this.model.findByIdAndUpdate(
          id1,
          { movimientoComplementario: id2 },
          { new: true }
        ),
        this.model.findByIdAndUpdate(
          id2,
          { movimientoComplementario: id1 },
          { new: true }
        ),
      ]);

      // Retornar con populate de caja para consistencia
      const [mov1, mov2] = await Promise.all([
        this.model.findById(upd1._id).populate("caja"),
        this.model.findById(upd2._id).populate("caja"),
      ]);

      return {
        success: true,
        data: {
          movimiento1: mov1 || upd1,
          movimiento2: mov2 || upd2,
        },
      };
    } catch (error) {
      return { success: false, error: error?.message || error };
    }
  }

  /**
   * Edita dos movimientos en conjunto. Si falla la actualización del segundo,
   * intenta revertir los cambios del primero usando los valores originales de los
   * campos modificados.
   */
  async editarCompuesto(id1, data1, id2, data2, nombreUsuario = "Sistema") {
    try {
      const [original1, original2] = await Promise.all([
        this.model.findById(id1).lean(),
        this.model.findById(id2).lean(),
      ]);
      if (!original1) return { success: false, error: "Movimiento 1 no encontrado" };
      if (!original2) return { success: false, error: "Movimiento 2 no encontrado" };

      // Inyectar actor para logs
      const payload1 = { ...(data1 || {}), nombreUsuario };

      // Guardar signos originales
      const getMontoFirmado = (mov) => {
        if (!mov) return 0;
        const moneda = mov.moneda;
        if (moneda === "ARS") return Number(mov.total?.ars || 0);
        if (mov.moneda === "USD") {
          return Number(
            mov.total?.usdBlue !== undefined && mov.total?.usdBlue !== null
              ? mov.total.usdBlue
              : mov.total?.usdOficial || 0
          );
        }
        return Number(mov.total?.ars || 0);
      };
      const s1Orig = Math.sign(getMontoFirmado(original1));
      const s2Orig = Math.sign(getMontoFirmado(original2));

      // 1) Actualizar primer movimiento
      const res1 = await this.updateMovimiento(id1, payload1);
      if (!res1?.success) {
        return { success: false, error: res1?.error || "Error al actualizar movimiento 1" };
      }

      // Obtener nuevo monto absoluto del movimiento 1 post-actualización
      const updated1After = await this.model.findById(id1).lean();
      const nuevoAbsMonto1 = Math.abs(getMontoFirmado(updated1After));

      // 2) Actualizar segundo movimiento con el mismo monto (magnitud) preservando su signo previo
      // updateMovimiento para EGRESO preserva signo del original y para INGRESO usa positivo
      const payload2 = {
        ...(data2 || {}),
        montoEnviado: nuevoAbsMonto1,
        nombreUsuario,
      };
      const res2 = await this.updateMovimiento(id2, payload2);
      if (!res2?.success) {
        // 3) Rollback del primero: solo de los campos modificados en data1
        try {
          const revertData = {};
          const setNested = (obj, path, value) => {
            const parts = path.split(".");
            let ref = obj;
            for (let i = 0; i < parts.length - 1; i++) {
              const p = parts[i];
              if (!ref[p] || typeof ref[p] !== "object") ref[p] = {};
              ref = ref[p];
            }
            ref[parts[parts.length - 1]] = value;
          };
          const flattenKeys = (prefix, val, acc) => {
            if (val && typeof val === "object" && !Array.isArray(val)) {
              for (const k of Object.keys(val)) {
                flattenKeys(prefix ? `${prefix}.${k}` : k, val[k], acc);
              }
            } else {
              acc.push(prefix);
            }
          };
          const changedPaths = [];
          flattenKeys("", data1 || {}, changedPaths);
          for (const path of changedPaths) {
            // recuperar valor original del path
            const getVal = (obj, p) =>
              p.split(".").reduce((a, key) => (a ? a[key] : undefined), obj);
            const originalValue = getVal(original1, path);
            setNested(revertData, path, originalValue === undefined ? null : originalValue);
          }
          await this.model.findByIdAndUpdate(id1, revertData, { new: true });
        } catch (rbError) {
          console.error("Error en rollback de edición compuesta:", rbError);
        }
        return { success: false, error: res2?.error || "Error al actualizar movimiento 2" };
      }

      // 3.1) Validación: ambos mantienen el mismo signo que tenían antes
      const updated1 = await this.model.findById(id1).lean();
      const updated2 = await this.model.findById(id2).lean();
      const s1New = Math.sign(getMontoFirmado(updated1));
      const s2New = Math.sign(getMontoFirmado(updated2));

      if (!(s1New === s1Orig && s2New === s2Orig)) {
        // Si no son signos opuestos, revertir ambos a los valores originales en campos modificados
        try {
          const buildRevert = (original, changes) => {
            const revert = {};
            const flattenKeys = (prefix, val, acc) => {
              if (val && typeof val === "object" && !Array.isArray(val)) {
                for (const k of Object.keys(val)) {
                  flattenKeys(prefix ? `${prefix}.${k}` : k, val[k], acc);
                }
              } else {
                acc.push(prefix);
              }
            };
            const changedPaths = [];
            flattenKeys("", changes || {}, changedPaths);
            const setNested = (obj, path, value) => {
              const parts = path.split(".");
              let ref = obj;
              for (let i = 0; i < parts.length - 1; i++) {
                const p = parts[i];
                if (!ref[p] || typeof ref[p] !== "object") ref[p] = {};
                ref = ref[p];
              }
              ref[parts[parts.length - 1]] = value;
            };
            const getVal = (obj, p) =>
              p.split(".").reduce((a, key) => (a ? a[key] : undefined), obj);
            for (const path of changedPaths) {
              const originalValue = getVal(original, path);
              setNested(revert, path, originalValue === undefined ? null : originalValue);
            }
            // Restaurar totales originales si hubo cambio de monto
            if (changes?.montoEnviado !== undefined || changes?.total !== undefined) {
              if (original?.total) {
                revert.total = original.total;
              }
            }
            return revert;
          };
          const revert1 = buildRevert(original1, data1);
          const revert2 = buildRevert(original2, payload2);
          // Asegurar restaurar monto/total del complementario
          if (original2?.total) {
            revert2.total = original2.total;
          }
          await Promise.all([
            this.model.findByIdAndUpdate(id1, { ...revert1, _actor: nombreUsuario }, { new: true }),
            this.model.findByIdAndUpdate(id2, { ...revert2, _actor: nombreUsuario }, { new: true }),
          ]);
        } catch (rbErr) {
          console.error("Error en rollback por validación de signos:", rbErr);
        }
        return { success: false, error: "Los movimientos deben mantener su signo original" };
      }

      // 4) Retornar ambos actualizados (populate caja para consistencia)
      const [mov1, mov2] = await Promise.all([
        this.model.findById(id1).populate("caja"),
        this.model.findById(id2).populate("caja"),
      ]);
      return { success: true, data: { movimiento1: mov1, movimiento2: mov2 } };
    } catch (error) {
      return { success: false, error: error?.message || error };
    }
  }

  async updateMovimiento(id, movimientoData) {
    try {
      const movimientoActual = await this.model.findById(id);
      if (!movimientoActual) {
        return { success: false, error: "Movimiento no encontrado" };
      }

      if (Object.prototype.hasOwnProperty.call(movimientoData, "fechaFactura")) {
        const normalizedFecha = BaseController.normalizeDateInput(
          movimientoData.fechaFactura
        );
        if (normalizedFecha === undefined) {
          delete movimientoData.fechaFactura;
        } else {
          movimientoData.fechaFactura = normalizedFecha;
        }
      }

      if (
        typeof movimientoData.clienteNombre === "string" &&
        movimientoData.clienteNombre.trim().length > 0
      ) {
        const nombreBuscado = movimientoData.clienteNombre.trim();
        const clienteDoc = await Cliente.findOne({
          nombre: { $regex: `^${nombreBuscado}$`, $options: "i" },
        });

        if (clienteDoc) {
          movimientoData.clienteId = clienteDoc._id;
          movimientoData.cliente = {
            nombre: clienteDoc.nombre,
            ccActivas: clienteDoc.ccActivas || [],
            descuento: clienteDoc.descuento || 0,
          };
        } else {
          // Si no existe, mantener solo el nombre y limpiar clienteId
          movimientoData.clienteId = null;
          movimientoData.cliente = { nombre: nombreBuscado };
        }

        delete movimientoData.clienteNombre;
      }

      const cambiaronTcOMonto =
        movimientoData.montoEnviado !== undefined ||
        movimientoData.tipoDeCambio !== undefined ||
        movimientoData.total !== undefined;

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

      // Reconstruir monto base si no vino explícito:
      // 1) Usar movimientoData.montoEnviado si llegó
      // 2) Si no, y llegó 'total' desde el cliente, inferir según 'moneda'
      // 3) Si no, usar total actual almacenado
      let montoBase;
      if (movimientoData.montoEnviado !== undefined) {
        montoBase = Number(movimientoData.montoEnviado);
      } else if (movimientoData.total !== undefined && movimientoData.total !== null) {
        if (moneda === "ARS") {
          montoBase = Number(movimientoData.total?.ars || 0);
        } else if (moneda === "USD") {
          const usdVal =
            movimientoData.total?.usdBlue !== undefined &&
            movimientoData.total?.usdBlue !== null
              ? movimientoData.total.usdBlue
              : movimientoData.total?.usdOficial;
          montoBase = Number(usdVal || 0);
        } else {
          // Fallback si moneda desconocida
          montoBase = Number(movimientoData.total?.ars || 0);
        }
      } else {
        montoBase =
          moneda === "ARS"
            ? movimientoActual.total?.ars || 0
            : movimientoActual.total?.usdBlue ||
              movimientoActual.total?.usdOficial ||
              0;
      }

      if (cambiaronTcOMonto && !soloCambioCaja) {
        let nuevosTotales;
        const signedBase = type === "EGRESO" ? -Math.abs(montoBase) : Math.abs(montoBase);

        if (type === "EGRESO") {
          // Recalcular equivalencias para pagos (EGRESO) igual que en createMovimiento,
          // respetando el signo de montoBase.
          if (moneda === "ARS") {
            nuevosTotales = {
              ars: signedBase,
              usdOficial: signedBase / oficial.venta,
              usdBlue: signedBase / blue.venta,
            };
          } else if (moneda === "USD") {
            nuevosTotales = {
              ars: signedBase * blue.venta,
              usdBlue: signedBase,
              usdOficial: signedBase,
            };
          } else {
            // Fallback para moneda desconocida
            nuevosTotales = {
              ars: signedBase,
              usdOficial: signedBase,
              usdBlue: signedBase,
            };
          }
        } else if (moneda === "ARS") {
          // Si vino TC manual y CC es USD, usarlo para esa CC; el resto automático
          const usdOficial =
            cuentaCorriente === "USD OFICIAL" &&
            movimientoData.tipoDeCambio !== undefined
              ? signedBase / tipoDeCambio
              : signedBase / oficial.venta;

          const usdBlue =
            cuentaCorriente === "USD BLUE" &&
            movimientoData.tipoDeCambio !== undefined
              ? signedBase / tipoDeCambio
              : signedBase / blue.venta;

          nuevosTotales = {
            ars: signedBase,
            usdOficial,
            usdBlue,
          };
        } else if (moneda === "USD") {
          const ars =
            cuentaCorriente === "ARS" &&
            movimientoData.tipoDeCambio !== undefined
              ? signedBase * tipoDeCambio
              : signedBase * blue.venta;

          nuevosTotales = {
            ars,
            usdBlue: signedBase,
            usdOficial: signedBase,
          };
        }

        movimientoData.total = nuevosTotales;
        movimientoData.tipoDeCambio = tipoDeCambio;

        // Recalcular y setear siempre montoDolarBalance alineado con total.usdBlue
          let usdBalance = 0;
          if (moneda === "USD") {
            usdBalance = signedBase;
          } else if (moneda === "ARS") {
            const fromTotales =
              nuevosTotales && typeof nuevosTotales.usdBlue === "number"
                ? nuevosTotales.usdBlue
                : (cuentaCorriente === "USD BLUE" &&
                    movimientoData.tipoDeCambio !== undefined)
                ? signedBase / tipoDeCambio
                : signedBase / blue.venta;
            usdBalance = fromTotales;
          } else {
            usdBalance = 0;
          }
          movimientoData.montoDolarBalance = Number(Number(usdBalance || 0).toFixed(2));
      
      }

      if (movimientoData.caja) {
        const caja = await Caja.findById(movimientoData.caja);
        if (!caja) return { success: false, error: "Caja no encontrada" };
      }

      const { nombreUsuario, ...datosMovimiento } = movimientoData;
      const updateData = { ...datosMovimiento };
      if (nombreUsuario) updateData._actor = nombreUsuario;

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
      const startDate = fechaInicio ? new Date(fechaInicio) : null;
      const endDateRaw = fechaFin ? new Date(fechaFin) : null;
      const endDate = endDateRaw ? new Date(endDateRaw.getTime()) : null;
      if (endDate) {
        // si vino solo día, asegurar fin de día
        if (!fechaFin.includes("T")) endDate.setHours(23, 59, 59, 999);
      }

      const dateFilter = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;

      const filters = Object.keys(dateFilter).length
        ? {
            $or: [
              { fechaFactura: dateFilter },
              { fechaFactura: null, fechaCreacion: dateFilter },
            ],
          }
        : {};

      if (!includeInactive) {
        filters.active = true;
      }

      const movimientos = await this.model
        .find(filters)
        .populate("cliente")
        .populate("caja")
        .sort({ fechaFactura: -1, fechaCreacion: -1 });
      return { success: true, data: movimientos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getClientesTotalesV2() {
    try {
      const CuentaPendiente = require("../models/cuentaPendiente.model.js");

      const cuentasPendientesAgrupadas = await CuentaPendiente.aggregate([
        {
          $match: {
            active: true,
            cliente: { $ne: null, $exists: true },
          },
        },
        {
          $group: {
            _id: "$cliente",
            totalARS: {
              $sum: {
                $cond: [{ $eq: ["$cc", "ARS"] }, "$montoTotal.ars", 0],
              },
            },
            totalUSDBlue: {
              $sum: {
                $cond: [{ $eq: ["$cc", "USD BLUE"] }, "$montoTotal.usdBlue", 0],
              },
            },
            totalUSDOficial: {
              $sum: {
                $cond: [
                  { $eq: ["$cc", "USD OFICIAL"] },
                  "$montoTotal.usdOficial",
                  0,
                ],
              },
            },
            fechaUltimaEntrega: { $max: "$fechaCuenta" },
          },
        },
      ]);

      const movimientosAgrupados = await this.model.aggregate([
        {
          $match: {
            active: true,
            clienteId: { $ne: null, $exists: true },
          },
        },
        {
          $group: {
            _id: "$clienteId",
            totalARS: {
              $sum: {
                $cond: [
                  { $eq: ["$cuentaCorriente", "ARS"] },
                  {
                    $cond: [
                      { $eq: ["$type", "INGRESO"] },
                      "$total.ars",
                      { $multiply: ["$total.ars", -1] },
                    ],
                  },
                  0,
                ],
              },
            },
            totalUSDBlue: {
              $sum: {
                $cond: [
                  { $eq: ["$cuentaCorriente", "USD BLUE"] },
                  {
                    $cond: [
                      { $eq: ["$type", "INGRESO"] },
                      "$total.usdBlue",
                      { $multiply: ["$total.usdBlue", -1] },
                    ],
                  },
                  0,
                ],
              },
            },
            totalUSDOficial: {
              $sum: {
                $cond: [
                  { $eq: ["$cuentaCorriente", "USD OFICIAL"] },
                  {
                    $cond: [
                      { $eq: ["$type", "INGRESO"] },
                      "$total.usdOficial",
                      { $multiply: ["$total.usdOficial", -1] },
                    ],
                  },
                  0,
                ],
              },
            },
            fechaUltimoPago: {
              $max: {
                $cond: [{ $eq: ["$type", "INGRESO"] }, "$fechaFactura", null],
              },
            },
          },
        },
      ]);

      const cuentasMap = new Map();
      cuentasPendientesAgrupadas.forEach((cuenta) => {
        cuentasMap.set(cuenta._id.toString(), {
          totalARS: cuenta.totalARS || 0,
          totalUSDBlue: cuenta.totalUSDBlue || 0,
          totalUSDOficial: cuenta.totalUSDOficial || 0,
          fechaUltimaEntrega: cuenta.fechaUltimaEntrega || null,
        });
      });

      const movimientosMap = new Map();
      movimientosAgrupados.forEach((mov) => {
        movimientosMap.set(mov._id.toString(), {
          totalARS: mov.totalARS || 0,
          totalUSDBlue: mov.totalUSDBlue || 0,
          totalUSDOficial: mov.totalUSDOficial || 0,
          fechaUltimoPago: mov.fechaUltimoPago || null,
        });
      });

      const clientes = await Cliente.find({});

      const clientesTotales = clientes.map((cliente) => {
        const clienteId = cliente._id.toString();

        const cuentaData = cuentasMap.get(clienteId) || {
          totalARS: 0,
          totalUSDBlue: 0,
          totalUSDOficial: 0,
          fechaUltimaEntrega: null,
        };

        const movData = movimientosMap.get(clienteId) || {
          totalARS: 0,
          totalUSDBlue: 0,
          totalUSDOficial: 0,
          fechaUltimoPago: null,
        };

        return {
          _id: cliente._id,
          cliente: cliente.nombre,
          ARS: cuentaData.totalARS + movData.totalARS,
          "USD BLUE": cuentaData.totalUSDBlue + movData.totalUSDBlue,
          "USD OFICIAL": cuentaData.totalUSDOficial + movData.totalUSDOficial,
          fechaUltimoPago: movData.fechaUltimoPago,
          fechaUltimaEntrega: cuentaData.fechaUltimaEntrega,
        };
      });

      clientesTotales.sort((a, b) => a.cliente.localeCompare(b.cliente));

      return { success: true, data: clientesTotales };
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

  async getArqueoTotal({ fechaInicio, fechaFin, cajaNombre } = {}) {
    try {
      const cajaDoc = await Caja.findOne({ nombre: cajaNombre || "EFECTIVO" });
      if (!cajaDoc) {
        return {
          success: false,
          error: `No se encontró la caja ${cajaNombre || "EFECTIVO"}`,
        };
      }

      const baseMatch = { active: true, caja: cajaDoc._id };

      const pipelineGeneral = [
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalARS: {
              $sum: { $cond: [{ $eq: ["$moneda", "ARS"] }, "$total.ars", 0] },
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

      // Rango de fechas opcional (sobre fechaFactura/fechaCreacion)
      let pipelineFiltrado = null;
      if (fechaInicio || fechaFin) {
        const parseFlexible = (value, endOfDay = false) => {
          if (!value) return null;
          let d = new Date(value);
          if (isNaN(d.getTime())) {
            const [y, m, rest] = String(value).split("-");
            const day = parseInt((rest || "").slice(0, 2));
            if (y && m && day) {
              d = new Date(parseInt(y), parseInt(m) - 1, day);
            }
          }
          if (isNaN(d.getTime())) return null;
          if (endOfDay) d.setHours(23, 59, 59, 999);
          else d.setHours(0, 0, 0, 0);
          return d;
        };

        const startDate = parseFlexible(fechaInicio, false);
        const endDate = parseFlexible(fechaFin, true);

        const dateExpr = {};
        if (startDate) dateExpr.$gte = startDate;
        if (endDate) dateExpr.$lte = endDate;

        if (Object.keys(dateExpr).length > 0) {
          pipelineFiltrado = [
            {
              $match: {
                ...baseMatch,
                $or: [
                  { fechaFactura: dateExpr },
                  { fechaFactura: null, fechaCreacion: dateExpr },
                ],
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
        }
      }

      const [generalRes, filtradoRes] = await Promise.all([
        this.model.aggregate(pipelineGeneral),
        pipelineFiltrado
          ? this.model.aggregate(pipelineFiltrado)
          : Promise.resolve([]),
      ]);

      const general =
        generalRes && generalRes.length > 0
          ? generalRes[0]
          : { totalARS: 0, totalUSD: 0, totalMovimientos: 0 };

      const filtrado =
        filtradoRes && filtradoRes.length > 0 ? filtradoRes[0] : null;

      return { success: true, data: { general, filtrado } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTotalesAgrupados(filters = {}) {
    try {
      console.log(
        "[getTotalesAgrupados] Filtros recibidos:",
        JSON.stringify(filters, null, 2)
      );

      // Determinar si se debe agrupar por categoría o caja basándose en los filtros
      const hasCategoriasFilter = filters.categoria && filters.categoria.$in;
      const hasCajasFilter = filters.caja && filters.caja.$in;

      const movimientos = await this.model.find(filters).lean();

      console.log(
        `[getTotalesAgrupados] Movimientos encontrados: ${movimientos.length}`
      );

      const agrupadosPorCategoria = {};
      const agrupadosPorCaja = {};

      movimientos.forEach((mov) => {
        // Agrupar por categoría si hay filtro de categorías
        if (hasCategoriasFilter) {
          const catKey = mov.categoria || "sin-categoria";
          if (!agrupadosPorCategoria[catKey]) {
            agrupadosPorCategoria[catKey] = { totalARS: 0, totalUSD: 0, totalUSDBalance: 0 };
          }
          if (mov.moneda === "ARS") {
            agrupadosPorCategoria[catKey].totalARS += mov.total?.ars || 0;
          } else if (mov.moneda === "USD") {
            agrupadosPorCategoria[catKey].totalUSD += mov.total?.usdBlue || 0;
          }
          agrupadosPorCategoria[catKey].totalUSDBalance += Number(mov.montoDolarBalance || 0);
        }

        // Agrupar por caja si hay filtro de cajas
        if (hasCajasFilter) {
          const cajaKey = mov.caja ? mov.caja.toString() : "sin-caja";
          if (!agrupadosPorCaja[cajaKey]) {
            agrupadosPorCaja[cajaKey] = { totalARS: 0, totalUSD: 0, totalUSDBalance: 0 };
          }
          if (mov.moneda === "ARS") {
            agrupadosPorCaja[cajaKey].totalARS += mov.total?.ars || 0;
          } else if (mov.moneda === "USD") {
            agrupadosPorCaja[cajaKey].totalUSD += mov.total?.usdBlue || 0;
          }
          agrupadosPorCaja[cajaKey].totalUSDBalance += Number(mov.montoDolarBalance || 0);
        }
      });

      const porCategoria = Object.entries(agrupadosPorCategoria).map(
        ([key, totals]) => ({
          key,
          totalARS: Math.round(totals.totalARS),
          totalUSD: Math.round(totals.totalUSD),
          totalUSDBalance: Math.round(totals.totalUSDBalance),
        })
      );

      const porCaja = Object.entries(agrupadosPorCaja).map(([key, totals]) => ({
        key,
        totalARS: Math.round(totals.totalARS),
        totalUSD: Math.round(totals.totalUSD),
        totalUSDBalance: Math.round(totals.totalUSDBalance),
      }));

      return {
        success: true,
        data: {
          porCategoria,
          porCaja,
        },
      };
    } catch (error) {
      console.error("[getTotalesAgrupados] ERROR:", error);
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
        _actor: nombreUsuario,
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
      const docs = await this.model.find({}).populate("caja");

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
