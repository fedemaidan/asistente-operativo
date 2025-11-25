const ClienteController = require("../controllers/clienteController");
const { getRowsValues } = require("../Utiles/GoogleServices/General");

function limpiarHeaders(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const h = rows[0] || [];
  const esHeader =
    (h[0] || "").toString().toLowerCase().includes("nombre") &&
    (h[1] || "").toString().toLowerCase().includes("descuento");
  return esHeader ? rows.slice(1) : rows;
}

function parseCCActivas(ccStr) {
  if (!ccStr) return [];
  return String(ccStr)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function importarClientesDesdeSheet(spreadsheetId) {
  console.log("[Importar Clientes] Inicio", { spreadsheetId });
  const rows = await getRowsValues(spreadsheetId, "Clientes");
  console.log("[Importar Clientes] Filas obtenidas:", Array.isArray(rows) ? rows.length : 0);
  const data = limpiarHeaders(rows);
  console.log("[Importar Clientes] Filas tras limpiar headers:", Array.isArray(data) ? data.length : 0);

  let creados = 0;
  for (const row of data) {
    const nombre = (row[0] || "").toString().trim();
    if (!nombre) continue;
    const descuento = Number(row[1] || 0) || 0;
    const ccActivas = parseCCActivas(row[2] || "");

    // Si ya existe, skip
    try {
      const existe = await ClienteController.getByNombre(nombre);
      if (existe?.success && existe?.data) continue;
    } catch (_) {}

    const resp = await ClienteController.createCliente({
      nombre,
      descuento,
      ccActivas: ccActivas.length > 0 ? ccActivas : ["ARS"],
      usuario: "Sistema",
    });
    if (resp?.success) creados += 1;
  }
  console.log("[Importar Clientes] Finalizado, creados:", creados);
  return { success: true, count: creados };
}

module.exports = { importarClientesDesdeSheet };
