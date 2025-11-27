const { getRowsValues } = require("../Utiles/GoogleServices/General");
const Movimiento = require("../models/movimiento.model");
const CajaController = require("../controllers/cajaController");
const ClienteController = require("../controllers/clienteController");

function limpiarHeaders(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const h = rows[0] || [];
  const esHeader = (h[0] || "").toString().toLowerCase().includes("número") ||
    (h[0] || "").toString().toLowerCase().includes("numero") ||
    (h[3] || "").toString().toLowerCase().includes("cliente");
  return esHeader ? rows.slice(1) : rows;
}

function splitNombreId(v) {
  const s = (v || "").toString();
  const trimmed = s.trim();
  const idx = trimmed.lastIndexOf("-");
  if (idx > -1) {
    const posibleSufijo = trimmed.slice(idx + 1).trim();
    const esIdHex24 = /^[a-fA-F0-9]{24}$/.test(posibleSufijo);
    const esUndefinedONull = /^(undefined|null)$/i.test(posibleSufijo);
    if (esIdHex24 || esUndefinedONull) {
      const nombre = trimmed.slice(0, idx).trim();
      return { nombre, id: esIdHex24 ? posibleSufijo : null };
    }
  }
  return { nombre: trimmed, id: null };
}

async function ensureCaja(nombre) {
  if (!nombre) return null;
  const found = await CajaController.getByNombre(nombre);
  if (found?.success && found?.data) return found.data;
  const created = await CajaController.createCaja({ nombre });
  if (created?.success) {
    // unwrap por createCaja -> data.data
    return created?.data?.data || created?.data;
  }
  return null;
}

async function ensureCliente(nombre) {
  if (!nombre) return null;
  const found = await ClienteController.getByNombre(nombre);
  if (found?.success && found?.data) return found.data;
  
  // Si no existe, no creamos forzosamente: devolvemos estructura mínima para subdoc
  return {
    nombre: nombre,
    ccActivas: ["ARS"],
    descuento: 0,
  };
}

async function importarComprobantesDesdeSheet(spreadsheetId) {
  console.log("[Importar Comprobantes] Inicio", { spreadsheetId });
  const rows = await getRowsValues(spreadsheetId, "Comprobantes");
  console.log("[Importar Comprobantes] Filas obtenidas:", Array.isArray(rows) ? rows.length : 0);
  const data = limpiarHeaders(rows);
  console.log("[Importar Comprobantes] Filas tras limpiar headers:", Array.isArray(data) ? data.length : 0);
  let creados = 0;

  for (const row of data) {
    const numero = (row[0] || "").toString().trim();
    const fechaISO = row[1] || "";
    const descripcion = row[2] || "";
    const categoria = row[3] || "";
    const clienteCell = splitNombreId(row[4]);
    const cajaNombre = row[5] || "";
    const moneda = (row[6] || "").toString().trim();
    const cc = (row[7] || "").toString().trim();
    const tipoDeCambio = Number(row[8] || 1) || 1;
    const estado = (row[9] || "").toString().trim() || "CONFIRMADO";
    const usuario = (row[10] || "").toString().trim() || "Sistema";
    const totARS = Number(row[11] || 0) || 0;
    const totBlue = Number(row[12] || 0) || 0;
    const totOf = Number(row[13] || 0) || 0;
    const imagen = row[14] || "";

    const fecha = fechaISO ? new Date(fechaISO) : null;
    const caja = await ensureCaja(cajaNombre);

    const movimientoDoc = {
      type: "INGRESO",
      numeroFactura: numero || null,
      fechaFactura: fecha || null,
      clienteId: clienteCell.id || null,
      cliente: {
        nombre: clienteCell.nombre || "-",
        ccActivas: [],
        descuento: 0,
      },
      cuentaCorriente: cc || "ARS",
      moneda,
      tipoFactura: "transferencia",
      caja: caja?._id || null,
      urlImagen: imagen || "",
      estado,
      nombreUsuario: usuario,
      empresaId: "celulandia",
      tipoDeCambio,
      descripcion: descripcion || "",
      categoria: categoria || null,
      total: {
        ars: totARS,
        usdOficial: totOf,
        usdBlue: totBlue,
      },
      active: true,
    };

    try {
      const created = await Movimiento.create(movimientoDoc);
      if (created?._id) creados += 1;
    } catch (e) {
      // continuar con el siguiente
    }
  }

  console.log("[Importar Comprobantes] Finalizado, creados:", creados);
  return { success: true, count: creados };
}

module.exports = { importarComprobantesDesdeSheet };
