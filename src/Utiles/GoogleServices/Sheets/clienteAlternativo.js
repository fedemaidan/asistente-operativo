const { addRow, getRowsValues, updateSheetWithBatchDelete } = require("../General");

async function syncClienteToAltSheet(cliente) {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID_ALTERNATIVO;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID_ALTERNATIVO no está configurado");
    const SHEET_NAME = "Clientes";
    const HEADERS = ["Nombre", "Descuento", "CC Activas"];

    const nombre = cliente?.nombre || "";
    const descuento =
      cliente?.descuento != null ? Number(cliente.descuento) : 0;
    const ccActivas = Array.isArray(cliente?.ccActivas)
      ? cliente.ccActivas.join(", ")
      : "";
    const rowValues = [nombre, descuento, ccActivas];

    await addRow(sheetId, rowValues, `${SHEET_NAME}!A1:Z1`, HEADERS);
  } catch (error) {
    console.error("Error al sincronizar cliente a Google Sheet:", error);
  }
}

/**
 * Actualiza un cliente en el Sheet buscando por el nombre anterior,
 * útil cuando el nombre cambia (atributo único).
 */
async function updateClienteInAltSheetByName(oldNombre, cliente) {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID_ALTERNATIVO;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID_ALTERNATIVO no está configurado");
    const SHEET_NAME = "Clientes";
    const rows = await getRowsValues(sheetId, SHEET_NAME);
    const dataRows = rows.slice(1).map((r) => [
      r?.[0] ?? "",
      r?.[1] != null ? Number(r[1]) : 0,
      r?.[2] ?? "",
    ]);

    const nombre = cliente?.nombre || "";
    const descuento = cliente?.descuento != null ? Number(cliente.descuento) : (dataRows.find(r => (r[0] || "") === oldNombre)?.[1] ?? 0);
    const ccActivas = Array.isArray(cliente?.ccActivas) ? cliente.ccActivas.join(", ") : (dataRows.find(r => (r[0] || "") === oldNombre)?.[2] ?? "");

    let idx = dataRows.findIndex((r) => (r[0] || "") === (oldNombre || ""));
    if (idx === -1) {
      // Fallback: intentar por el nuevo nombre por si ya estaba renombrado
      idx = dataRows.findIndex((r) => (r[0] || "") === (nombre || ""));
      if (idx === -1) {
        return { success: false, error: "Cliente no encontrado en Google Sheet" };
      }
    }

    dataRows[idx] = [nombre, descuento, ccActivas];
    await updateSheetWithBatchDelete(
      sheetId,
      `${SHEET_NAME}!A2:C10000`,
      dataRows,
      2
    );
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar cliente (rename) en Google Sheet:", error);
    return { success: false, error: error.message };
  }
}

async function updateClienteCuentasActivasInAltSheet(nombre, cuentasActivas) {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID_ALTERNATIVO;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID_ALTERNATIVO no está configurado");
    const SHEET_NAME = "Clientes";
    const rows = await getRowsValues(sheetId, SHEET_NAME);
    const dataRows = rows.slice(1).map((r) => [
      r?.[0] ?? "",
      r?.[1] != null ? Number(r[1]) : 0,
      r?.[2] ?? "",
    ]);
    const idx = dataRows.findIndex((r) => (r[0] || "") === (nombre || ""));
    if (idx === -1) {
      return { success: false, error: "Cliente no encontrado en Google Sheet" };
    }
    const descuento = dataRows[idx][1] != null ? Number(dataRows[idx][1]) : 0;
    const ccActivas = Array.isArray(cuentasActivas) ? cuentasActivas.join(", ") : (cuentasActivas || "");
    dataRows[idx] = [nombre, descuento, ccActivas];
    await updateSheetWithBatchDelete(
      sheetId,
      `${SHEET_NAME}!A2:C10000`,
      dataRows,
      2
    );
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar CC Activas en Google Sheet:", error);
    return { success: false, error: error.message };
  }
}

async function deleteClienteFromAltSheet(nombre) {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID_ALTERNATIVO;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID_ALTERNATIVO no está configurado");
    const SHEET_NAME = "Clientes";
    const rows = await getRowsValues(sheetId, SHEET_NAME);
    const dataRows = rows.slice(1).map((r) => [
      r?.[0] ?? "",
      r?.[1] != null ? Number(r[1]) : 0,
      r?.[2] ?? "",
    ]);
    const filtered = dataRows.filter((r) => (r[0] || "") !== (nombre || ""));
    if (filtered.length === dataRows.length) {
      return { success: false, error: "Cliente no encontrado en Google Sheet" };
    }
    await updateSheetWithBatchDelete(
      sheetId,
      `${SHEET_NAME}!A2:C10000`,
      filtered,
      2
    );
    return { success: true };
  } catch (error) {
    console.error("Error al eliminar cliente en Google Sheet:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  syncClienteToAltSheet,
  updateClienteInAltSheetByName,
  updateClienteCuentasActivasInAltSheet,
  deleteClienteFromAltSheet,
};


