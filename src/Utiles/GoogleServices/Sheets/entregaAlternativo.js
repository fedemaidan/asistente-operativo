const { getRowsValues } = require("../General");
const { getFechaArgentina } = require("../../Funciones/HandleDates");
const DolarService = require("../../../services/monedasService/dolarService");
const ClienteController = require("../../../controllers/clienteController");
const CuentaPendienteController = require("../../../controllers/cuentaPendienteController");

async function importarEntregasAlternativo() {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID_ALTERNATIVO;
    if (!sheetId) {
      return { success: false, error: "GOOGLE_SHEET_ID_ALTERNATIVO no está configurado" };
    }
    const SHEET_NAME = "Entregas";
    const rows = await getRowsValues(sheetId, SHEET_NAME);
    if (!Array.isArray(rows) || rows.length <= 1) {
      return { success: true, created: 0, errors: [] };
    }

    const cotizaciones = await DolarService.obtenerValoresDolar();
    const tcBlue = Number(cotizaciones?.blue?.venta || cotizaciones?.blue || 1);
    const tcOficial = Number(cotizaciones?.oficial?.venta || cotizaciones?.oficial || 1);

    const dataRows = rows.slice(1);
    let created = 0;
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] || [];
      const [clienteRaw, descripcionRaw, montoRaw, monedaRaw, ccRaw, descuentoRaw] = row;
      const rowNum = i + 2;

      const clienteNombre = String(clienteRaw || "").trim();
      const descripcion = String(descripcionRaw || "").trim();
      const moneda = String(monedaRaw || "").trim().toUpperCase();
      const cc = String(ccRaw || "").trim().toUpperCase();

      let monto = Number(String(montoRaw || "0").toString().replace(/[^0-9.-]/g, ""));
      if (!isFinite(monto) || monto === 0) {
        errors.push({ row: rowNum, error: "Monto inválido o cero" });
        continue;
      }
      // Monto siempre negativo
      if (monto > 0) monto = -monto;

      if (!clienteNombre) {
        errors.push({ row: rowNum, error: "Cliente requerido" });
        continue;
      }
      if (!["ARS", "USD"].includes(moneda)) {
        errors.push({ row: rowNum, error: `Moneda inválida: ${moneda}` });
        continue;
      }
      const ccValidas = ["ARS", "USD BLUE", "USD OFICIAL"];
      if (!ccValidas.includes(cc)) {
        errors.push({ row: rowNum, error: `CC inválida: ${cc}` });
        continue;
      }

      // Descuento: si viene D entre 0..1, guardar 1 - D. Si no, 1.
      let descuentoIngresado = Number(descuentoRaw);
      if (!isFinite(descuentoIngresado)) descuentoIngresado = 0;
      if (descuentoIngresado < 0) descuentoIngresado = 0;
      if (descuentoIngresado > 1) descuentoIngresado = 1;
      const descuentoAplicado = 1 - descuentoIngresado; // factor multiplicador

      try {
        // Buscar cliente por nombre
        const cliResp = await ClienteController.getByNombre(clienteNombre);
        let clienteId = null;
        if (cliResp?.success && cliResp?.data?._id) {
          clienteId = cliResp.data._id;
        }

        // Tipo de cambio según moneda/CC (mismo criterio que movimientos)
        const resolveTc = () => {
          if ((moneda === "ARS" && cc === "ARS") || (moneda === "USD" && (cc === "USD BLUE" || cc === "USD OFICIAL"))) {
            return 1;
          }
          if (moneda === "ARS" && cc === "USD BLUE") return tcBlue;
          if (moneda === "ARS" && cc === "USD OFICIAL") return tcOficial;
          if (moneda === "USD" && cc === "ARS") return tcBlue;
          return 1;
        };
        const tipoDeCambio = resolveTc();

        // Calcular monto en moneda de CC sin descuento (subtotalEntrega positivo)
        const montoAbs = Math.abs(monto);
        let subtotalEntrega = 0;
        if (cc === "ARS") {
          subtotalEntrega = moneda === "ARS" ? montoAbs : Math.round(montoAbs * tcBlue);
        } else if (cc === "USD BLUE") {
          subtotalEntrega = moneda === "USD" ? montoAbs : Math.round(montoAbs / tcBlue);
        } else if (cc === "USD OFICIAL") {
          subtotalEntrega = moneda === "USD" ? montoAbs : Math.round(montoAbs / tcOficial);
        }

        // SubTotal (sin descuento) siguiendo la lógica del frontend
        let subTotal = { ars: 0, usdOficial: 0, usdBlue: 0 };
        if (cc === "ARS") {
          subTotal = {
            ars: moneda === "ARS" ? -montoAbs : -subtotalEntrega,
            usdOficial: moneda === "USD" ? -montoAbs : -Math.round(subtotalEntrega / tcOficial),
            usdBlue: moneda === "USD" ? -montoAbs : -Math.round(subtotalEntrega / tcBlue),
          };
        } else if (cc === "USD OFICIAL") {
          subTotal = {
            ars: moneda === "ARS" ? -montoAbs : -Math.round(subtotalEntrega * tcOficial),
            usdOficial: moneda === "USD" ? -montoAbs : -subtotalEntrega,
            usdBlue: moneda === "USD" ? -montoAbs : -subtotalEntrega,
          };
        } else if (cc === "USD BLUE") {
          subTotal = {
            ars: moneda === "ARS" ? -montoAbs : -Math.round(subtotalEntrega * tcBlue),
            usdOficial: moneda === "USD" ? -montoAbs : -subtotalEntrega,
            usdBlue: moneda === "USD" ? -montoAbs : -subtotalEntrega,
          };
        }

        // Total con descuento en CC (aplica descuento sobre subtotalEntrega)
        const totalEntrega = Math.round(subtotalEntrega * descuentoAplicado);
        let montoTotal = { ars: 0, usdOficial: 0, usdBlue: 0 };
        if (cc === "ARS") {
          montoTotal = {
            ars: -totalEntrega,
            usdOficial: -Math.round(totalEntrega / tcOficial),
            usdBlue: -totalEntrega,
          };
        } else if (cc === "USD OFICIAL") {
          montoTotal = {
            ars: -Math.round(totalEntrega * tcOficial),
            usdOficial: -totalEntrega,
            usdBlue: -totalEntrega,
          };
        } else if (cc === "USD BLUE") {
          montoTotal = {
            ars: -Math.round(totalEntrega * tcBlue),
            usdOficial: -totalEntrega,
            usdBlue: -totalEntrega,
          };
        }

        const payload = {
          descripcion,
          proveedorOCliente: clienteNombre,
          fechaCuenta: getFechaArgentina(),
          descuentoAplicado,
          subTotal,
          montoTotal,
          empresaId: "celulandia",
          moneda,
          cc,
          tipoDeCambio,
          usuario: "Sistema",
          cliente: clienteId,
          active: false,
        };

        const res = await CuentaPendienteController.createCuentaPendiente(payload);
        if (!res?.success) {
          errors.push({ row: rowNum, error: res?.error || "Error al crear entrega" });
          continue;
        }
        created += 1;
      } catch (e) {
        errors.push({ row: rowNum, error: e?.message || String(e) });
      }
    }

    return { success: errors.length === 0, created, errors };
  } catch (error) {
    return { success: false, error: error.message || error };
  }
}

module.exports = { importarEntregasAlternativo };


