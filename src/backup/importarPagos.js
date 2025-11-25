const { getRowsValues } = require("../Utiles/GoogleServices/General");
const MovimientoController = require("../controllers/movimientoController");
const CajaController = require("../controllers/cajaController");

function limpiarHeaders(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const h = rows[0] || [];
  const esHeader = (h[0] || "").toString().toLowerCase().includes("id movimiento") ||
    (h[4] || "").toString().toLowerCase().includes("caja");
  return esHeader ? rows.slice(1) : rows;
}

async function ensureCaja(nombre) {
  if (!nombre) return null;
  const found = await CajaController.getByNombre(nombre);
  if (found?.success && found?.data) return found.data;
  const created = await CajaController.createCaja({ nombre });
  if (created?.success) {
    return created?.data?.data || created?.data;
  }
  return null;
}

async function importarPagosDesdeSheet(spreadsheetId) {
  const rows = await getRowsValues(spreadsheetId, "Pagos");
  const data = limpiarHeaders(rows);
  let creados = 0;

  for (const row of data) {
    const fechaISO = row[1] || "";
    const descripcion = row[2] || "";
    const categoria = row[3] || "";
    const cajaNombre = row[4] || "";
    const moneda = (row[5] || "").toString().trim();
    const cc = (row[6] || "").toString().trim();
    const tipoDeCambio = Number(row[7] || 1) || 1;
    const estado = (row[8] || "").toString().trim() || "CONFIRMADO";
    const usuario = (row[9] || "").toString().trim() || "Sistema";
    const totARS = Number(row[10] || 0) || 0;
    const totBlue = Number(row[11] || 0) || 0;
    const totOf = Number(row[12] || 0) || 0;


    console.log("totARS", totARS, Number(totARS));
    console.log("totBlue", totBlue, Number(totBlue));
    console.log("totOf", totOf, Number(totOf));

    const fecha = fechaISO ? new Date(fechaISO) : null;
    const caja = await ensureCaja(cajaNombre);

    let montoEnviado = 0;
    if (moneda === "ARS") montoEnviado = totARS;
    else if (moneda === "USD") {
      if (cc === "USD BLUE") montoEnviado = totBlue;
      else if (cc === "USD OFICIAL") montoEnviado = totOf;
      else montoEnviado = totBlue || totOf;
    }

    const movimientoData = {
      type: "EGRESO",
      numeroFactura: null,
      fechaFactura: fecha || null,
      clienteId: null,
      cliente: {
        nombre: null,
        ccActivas: [],
        descuento: 0,
      },
      cuentaCorriente: cc || "ARS",
      moneda,
      tipoFactura: "transferencia",
      caja: caja?._id || null,
      urlImagen: "",
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
      // continuar
    }
  }

  console.log("[Importar Pagos] Finalizado, creados:", creados);
  return { success: true, count: creados };
}

module.exports = { importarPagosDesdeSheet };
