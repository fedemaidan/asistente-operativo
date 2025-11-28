const { getRowsValues } = require("../Utiles/GoogleServices/General");
const CuentaPendienteController = require("../controllers/cuentaPendienteController");
const ClienteController = require("../controllers/clienteController");

function limpiarHeaders(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const h = rows[0] || [];
  const esHeader = (h[0] || "").toString().toLowerCase().includes("id cuenta pendiente") ||
    (h[1] || "").toString().toLowerCase().includes("número entrega") ||
    (h[3] || "").toString().toLowerCase().includes("cliente");
  return esHeader ? rows.slice(1) : rows;
}

function splitNombreId(v) {
  const s = (v || "").toString().trim();
  const idx = s.lastIndexOf("-");
  if (idx > -1) {
    const suf = s.slice(idx + 1).trim();
    const esHex24 = /^[a-fA-F0-9]{24}$/.test(suf);
    const esUndefinedONull = /^(undefined|null)$/i.test(suf);
    if (esHex24 || esUndefinedONull) {
      return { nombre: s.slice(0, idx).trim(), id: esHex24 ? suf : null };
    }
  }
  return { nombre: s, id: null };
}

async function ensureCliente(nombre) {
  if (!nombre) return null;
  const found = await ClienteController.getByNombre(nombre);
  if (found?.success && found?.data) return found.data;

  console.log("[Importar Entregas] No se encontro el cliente ", nombre, ". creando nuevo cliente...");
  const created = await ClienteController.createCliente(
    {
      nombre,
      usuario: "Sistema",
      ccActivas: ["ARS"],
      descuento: 0,
    },
    { syncToSheet: false } 
  );
  if (created?.success) return created.data;
  return null;
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
    // Fallback: si no viene ID, intentar buscar por nombre o crear si no existe
    let clienteId = idExplicito || null;
    let cliente = null;
    if (!clienteId && clienteNombre) {
      try {
        const found = await ClienteController.getByNombre(clienteNombre);
        if (found?.success && found?.data?._id) {
          clienteId = String(found.data._id);
        }
      } catch (_) {}
    }
    if (!clienteId) {
      cliente = await ensureCliente(clienteNombre);
      clienteId = cliente?._id || null;
    }

    const cuentaData = {
      descripcion: numeroEntrega || "",
      fechaCuenta: fecha,
      fechaCreacion: fecha,
      proveedorOCliente: clienteId
        ? (clienteNombre || "-")
        : (cliente?.nombre || clienteNombre || "-"),
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
