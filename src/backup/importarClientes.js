const ClienteController = require("../controllers/clienteController");
const { getRowsValues } = require("../Utiles/GoogleServices/General");

function limpiarHeaders(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const h = rows[0] || [];
  const h0 = (h[0] || "").toString().toLowerCase();
  const h1 = (h[1] || "").toString().toLowerCase();
  const h2 = (h[2] || "").toString().toLowerCase();
  // Detecta encabezados nuevos: Nombre | ID Cliente | Descuento | CC Activas
  // o variantes antiguas.
  const esHeader =
    (h0.includes("nombre") && (h1.includes("id cliente") || h2.includes("descuento")));
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
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[Importar Clientes][debug] Header detectado:", rows[0]);
  }
  const data = limpiarHeaders(rows);
  console.log("[Importar Clientes] Filas tras limpiar headers:", Array.isArray(data) ? data.length : 0);
  try {
    const muestras = (Array.isArray(data) ? data : []).slice(0, 5).map((row) => ({
      nombre: (row?.[0] || "").toString().trim(),
      id: (row?.[1] || "").toString().trim(),
      descuento: row?.[2],
      cc: row?.[3],
    }));
    console.log("[Importar Clientes][debug] Primeras filas (muestra):", muestras);
  } catch (e) {
    console.log("[Importar Clientes][debug] error generando muestras:", e?.message || String(e));
  }

  let creados = 0;
  let skipsPorId = 0;
  let skipsPorNombre = 0;
  let errores = 0;
  for (const row of data) {
    const nombreCell = (row[0] || "").toString().trim();
    const nombre = nombreCell;
    // ID Cliente viene en la columna 2 (índice 1)
    const idExplicitoRaw = (row[1] || "").toString().trim();
    const idExplicito = /^[a-fA-F0-9]{24}$/.test(idExplicitoRaw)
      ? idExplicitoRaw
      : null;
    const id = idExplicito;
    if (!nombre) continue;
    // Descuento en columna 3 (índice 2)
    const descuento = Number(row[2] || 0) || 0;
    // CC Activas en columna 4 (índice 3)
    const ccActivas = parseCCActivas(row[3] || "");

    // Si ya existe, skip
    try {
      if (id) {
        // Si viene ID, intentar buscar por ID exacto
        const byId = await ClienteController.getById?.(id);
        if (byId?.success && byId?.data) {
          skipsPorId += 1;
          continue;
        }
      }
      const byName = await ClienteController.getByNombre(nombre);
      if (byName?.success && byName?.data) {
        skipsPorNombre += 1;
        continue;
      }
    } catch (e) {
      errores += 1;
    }

    const resp = await ClienteController.createCliente(
      {
        ...(id ? { _id: id } : {}),
        nombre,
        descuento,
        ccActivas: ccActivas.length > 0 ? ccActivas : ["ARS"],
        usuario: "Sistema",
      },
      { syncToSheet: false }
    );
    if (resp?.success) creados += 1;
  }
  console.log("[Importar Clientes] Finalizado, creados:", creados);
  console.log("[Importar Clientes][debug] skipsPorId:", skipsPorId, "skipsPorNombre:", skipsPorNombre, "errores:", errores);
  return { success: true, count: creados };
}

module.exports = { importarClientesDesdeSheet };
