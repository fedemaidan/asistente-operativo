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
  const s = (v || "").toString();
  const m = s.match(/-(\w{24})$/);
  if (m) {
    const id = m[1];
    const nombre = s.slice(0, s.length - (id.length + 1));
    return { nombre: nombre.trim(), id };
  }
  return { nombre: s.trim(), id: null };
}

async function ensureCliente(nombre) {
  if (!nombre) return null;
  const found = await ClienteController.getByNombre(nombre);
  if (found?.success && found?.data) return found.data;


  console.log("[Importar Entregas] No se encontro el cliente ", nombre, ". creando nuevo cliente...");
  const created = await ClienteController.createCliente({
    nombre,
    usuario: "Sistema",
    ccActivas: ["ARS"],
    descuento: 0,
  });
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
    const clienteCell = splitNombreId(row[3]);
    const moneda = (row[4] || "").toString().trim();
    const cc = (row[5] || "").toString().trim();
    const descuentoAplicado = Number(row[6] || 1) || 1;
    const tipoDeCambio = Number(row[7] || 1) || 1;
    const usuario = (row[8] || "").toString().trim() || "Sistema";

    const subARS = Number(row[9] || 0) || 0;
    const subBlue = Number(row[10] || 0) || 0;
    const subOf = Number(row[11] || 0) || 0;

    const totARS = Number(row[12] || 0) || 0;
    const totBlue = Number(row[13] || 0) || 0;
    const totOf = Number(row[14] || 0) || 0;

    const fecha = fechaISO ? new Date(fechaISO) : new Date();
    const cliente = await ensureCliente(clienteCell.nombre);

    const cuentaData = {
      descripcion: numeroEntrega || "",
      fechaCuenta: fecha,
      fechaCreacion: fecha,
      proveedorOCliente: cliente?.nombre || clienteCell.nombre || "-",
      descuentoAplicado,
      subTotal: { ars: subARS, usdOficial: subOf, usdBlue: subBlue },
      montoTotal: { ars: totARS, usdOficial: totOf, usdBlue: totBlue },
      moneda,
      cc,
      tipoDeCambio,
      usuario,
      cliente: cliente?._id || null,
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
