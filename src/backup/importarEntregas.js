const { getRowsValues } = require("../Utiles/GoogleServices/General");
const CuentaPendienteController = require("../controllers/cuentaPendienteController");

function limpiarHeaders(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const h = rows[0] || [];
  const esHeader = (h[0] || "").toString().toLowerCase().includes("id cuenta pendiente") ||
    (h[1] || "").toString().toLowerCase().includes("número entrega") ||
    (h[3] || "").toString().toLowerCase().includes("cliente");
  return esHeader ? rows.slice(1) : rows;
}


async function importarEntregasDesdeSheet(spreadsheetId) {
  const rows = await getRowsValues(spreadsheetId, "Entregas");
  const data = limpiarHeaders(rows);
  let creados = 0;

  for (const row of data) {
    // Columns per export: [ID, Nro, Fecha, Cliente, Moneda, CC, Descuento, TipoCambio, Usuario, subARS, subBlue, subOf, totARS, totBlue, totOf, camposBusqueda]
    const numeroEntrega = (row[1] || "").toString().trim();
    const fechaISO = row[2] || "";
    const clienteNombre = (row[3] || "").toString().trim();
    const posibleIdExplicito = (row[4] || "").toString().trim();
    const idExplicito = /^[a-fA-F0-9]{24}$/.test(posibleIdExplicito) ? posibleIdExplicito : null;
    const moneda = (row[5] || "").toString().trim();
    const cc = (row[6] || "").toString().trim();
    const descuentoAplicado = Number(row[7] || 1) || 1;
    const tipoDeCambio = Number(row[8] || 1) || 1;
    const usuario = (row[9] || "").toString().trim() || "Sistema";

    const subARS = Number(row[10] || 0) || 0;
    const subBlue = Number(row[11] || 0) || 0;
    const subOf = Number(row[12] || 0) || 0;

    const totARS = Number(row[13] || 0) || 0;
    const totBlue = Number(row[14] || 0) || 0;
    const totOf = Number(row[15] || 0) || 0;

    const fecha = fechaISO ? new Date(fechaISO) : new Date();
    // Si no viene ID explícito, omitir la entrega
    let clienteId = idExplicito || null;
    if (!clienteId) {
        console.log("[Importar Entregas] No se encontro el cliente ", clienteNombre, ". omitiendo entrega...");
        continue;
    }

    const cuentaData = {
      descripcion: numeroEntrega || "",
      fechaCuenta: fecha,
      fechaCreacion: fecha,
      proveedorOCliente: clienteNombre || "-",
      descuentoAplicado,
      subTotal: { ars: subARS, usdOficial: subOf, usdBlue: subBlue },
      montoTotal: { ars: totARS, usdOficial: totOf, usdBlue: totBlue },
      moneda,
      cc,
      tipoDeCambio,
      usuario,
      cliente: clienteId || null,
      empresaId: "celulandia",
      active: true,
    };

    try {
      const resp = await CuentaPendienteController.createCuentaPendiente(cuentaData);
      if (resp?.success) creados += 1;
    } catch (e) {
      // continuar
    }
  }

  console.log("[Importar Entregas] Finalizado, creados:", creados);
  return { success: true, count: creados };
}

module.exports = { importarEntregasDesdeSheet };
