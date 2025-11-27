const { getRowsValues } = require("../General");
const MovimientoController = require("../../../controllers/movimientoController");
const { getFechaArgentina } = require("../../Funciones/HandleDates");
const CajaController = require("../../../controllers/cajaController");

/**
 * Lee la hoja 'Pagos' del Google Sheet alternativo (fila 2 en adelante)
 * y crea movimientos de tipo EGRESO.
 *
 * Cabeceras esperadas (A:D):
 * A: Concepto -> descripcion
 * B: Cuenta de origen (nombre de caja)
 * C: Monto (se convierte a negativo)
 * D: Moneda ('ARS' | 'USD')
 */
async function importarPagosAlternativo() {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID_ALTERNATIVO;
    if (!sheetId) {
      return { success: false, error: "GOOGLE_SHEET_ID_ALTERNATIVO no está configurado" };
    }
    const SHEET_NAME = "Pagos";
    const rows = await getRowsValues(sheetId, SHEET_NAME);
    if (!Array.isArray(rows) || rows.length <= 1) {
      return { success: true, created: 0, errors: [] };
    }

    const dataRows = rows.slice(1);
    let created = 0;
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] || [];
      const [conceptoRaw, cuentaOrigenRaw, montoRaw, monedaRaw] = row;
      const rowNum = i + 2;

      const descripcion = String(conceptoRaw || "").trim();
      const cajaNombre = String(cuentaOrigenRaw || "").trim();
      const moneda = String(monedaRaw || "").trim().toUpperCase();
      let monto = Number(String(montoRaw || "0").toString().replace(/[^0-9.-]/g, ""));
      if (!isFinite(monto) || monto === 0) {
        errors.push({ row: rowNum, error: "Monto inválido o cero" });
        continue;
      }
      if (monto > 0) monto = -monto;

      let cuentaCorriente = null;
      if (moneda === "ARS") {
        cuentaCorriente = "ARS";
      } else if (moneda === "USD") {
        cuentaCorriente = "USD BLUE";
      } else {
        errors.push({ row: rowNum, error: `Moneda inválida: ${moneda}` });
        continue;
      }

      const fechaFactura = getFechaArgentina();

      try {
        const cajaResp = await CajaController.getByNombre(cajaNombre);
        if (!cajaResp?.success || !cajaResp?.data?._id) {
          errors.push({ row: rowNum, error: `Caja no encontrada: ${cajaNombre}` });
          continue;
        }
        const cajaId = cajaResp.data._id;

        const movimientoData = {
          type: "EGRESO",
          tipoFactura: "transferencia",
          moneda,
          cuentaCorriente,
          caja: cajaId,
          fechaFactura,
          nombreUsuario: "Sistema",
          descripcion,
          estado: "CONFIRMADO",
          empresaId: "celulandia",
          active: false,
        };

        const res = await MovimientoController.createMovimiento(
          movimientoData,
          monto,
          true,
          true
        );
        if (!res?.success) {
          errors.push({ row: rowNum, error: res?.error || "Error al crear pago" });
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

module.exports = { importarPagosAlternativo };


