const { getRowsValues } = require("../Utiles/GoogleServices/General");
const Movimiento = require("../models/movimiento.model");
const CajaController = require("../controllers/cajaController");

function limpiarHeaders(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const h = rows[0] || [];
  const esHeader = (h[0] || "").toString().toLowerCase().includes("número") ||
    (h[0] || "").toString().toLowerCase().includes("numero") ||
    (h[3] || "").toString().toLowerCase().includes("cliente");
  return esHeader ? rows.slice(1) : rows;
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
    const clienteNombre = (row[4] || "").toString().trim();
    const posibleIdExplicito = (row[5] || "").toString().trim();
    const idExplicito = /^[a-fA-F0-9]{24}$/.test(posibleIdExplicito) ? posibleIdExplicito : null;
    const cajaNombre = row[6] || "";
    const moneda = (row[7] || "").toString().trim();
    const cc = (row[8] || "").toString().trim();
    const tipoDeCambio = Number(row[9] || 1) || 1;
    const estado = (row[10] || "").toString().trim() || "CONFIRMADO";
    const usuario = (row[11] || "").toString().trim() || "Sistema";
    const totARS = Number(row[12] || 0) || 0;
    const totBlue = Number(row[13] || 0) || 0;
    const totOf = Number(row[14] || 0) || 0;
    const imagen = row[15] || "";

    const fecha = fechaISO ? new Date(fechaISO) : null;
    const caja = await ensureCaja(cajaNombre);

    const cajaNombreUpper = (cajaNombre || "").toString().toUpperCase().trim();
    const esCheque = cajaNombreUpper === "CHEQUE" || cajaNombreUpper === "ECHEQ";
    const tipoFactura = esCheque ? "cheque" : "transferencia";

    let clienteIdFinal = idExplicito || null;

    const movimientoDoc = {
      type: "INGRESO",
      numeroFactura: numero || null,
      fechaFactura: fecha || null,
      clienteId: clienteIdFinal,
      cliente: {
        nombre: clienteNombre || "-",
        ccActivas: [],
        descuento: 0,
      },
      cuentaCorriente: cc || "ARS",
      moneda,
      tipoFactura,
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
