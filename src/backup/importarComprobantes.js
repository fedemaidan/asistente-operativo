const { getRowsValues } = require("../Utiles/GoogleServices/General");
const MovimientoController = require("../controllers/movimientoController");
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
  const m = s.match(/-(\w{24})$/);
  if (m) {
    const id = m[1];
    const nombre = s.slice(0, s.length - (id.length + 1));
    return { nombre: nombre.trim(), id };
  }
  return { nombre: s.trim(), id: null };
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
  
  return {
    nombre: nombre,
    ccActivas: ["ARS"],
    descuento: 0,
  }
}

async function importarComprobantesDesdeSheet(spreadsheetId) {
  const rows = await getRowsValues(spreadsheetId, "Comprobantes");
  const data = limpiarHeaders(rows);
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
    const cliente = await ensureCliente(clienteCell.nombre);

    // Calcular monto enviado a partir de totales
    let montoEnviado = 0;
    if (moneda === "ARS") montoEnviado = totARS;
    else if (moneda === "USD") {
      if (cc === "USD BLUE") montoEnviado = totBlue;
      else if (cc === "USD OFICIAL") montoEnviado = totOf;
      else montoEnviado = totBlue || totOf;
    }

    const movimientoData = {
      type: "INGRESO",
      numeroFactura: numero || null,
      fechaFactura: fecha || null,
      clienteId: cliente?._id || null,
      cliente: {
        nombre: cliente?.nombre || clienteCell.nombre || "-",
        ccActivas: cliente?.ccActivas || [],
        descuento: cliente?.descuento || 0,
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
    };

    try {
      const res = await MovimientoController.createMovimiento(
        movimientoData,
        montoEnviado,
        false,
        true
      );
      if (res?.success) creados += 1;
    } catch (e) {
      // continuar con el siguiente
    }
  }

  return { success: true, count: creados };
}

module.exports = { importarComprobantesDesdeSheet };
