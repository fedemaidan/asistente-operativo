const general_range = "ComprobanteRAW!A1:X100000";
const cajaController = require("../../../controllers/cajaController");
const clienteController = require("../../../controllers/clienteController");
const MovimientoController = require("../../../controllers/movimientoController");
const { addRow, updateRow, getRowsValues, getLastRow } = require("../General");
const { randomUUID } = require("crypto");
function generarUUIDConTimestamp() {
  const uuid = randomUUID();
  const timestamp = Date.now();
  return `${uuid}-${timestamp}`;
}

async function getArrayToSheetGeneral(comprobante) {
  const values = [
    comprobante.numero_comprobante,
    comprobante.fecha,
    comprobante.hora,
    comprobante.cliente,
    comprobante.destino,
    comprobante.montoEnviado,
    comprobante.monto,
    comprobante.moneda,
    comprobante.tipoDeCambio,
    comprobante.estado,
    comprobante.imagen ?? "",
    comprobante.usuario,
    "-",
    "-",
    comprobante.moneda === "ARS" ? comprobante.monto : "",
    comprobante.moneda === "USD BLUE" ? comprobante.monto : "",
    comprobante.moneda === "USD OFICIAL" ? comprobante.monto : "",
    comprobante.monto,
    "ARS", // Siempre se reciben pesos
    comprobante.montoEnviado,
    0,
    "-",
    comprobante.destino,
    comprobante.id,
  ];
  return values;
}

function getArrayFromMongoToSheet(movimiento) {
  const fecha = new Date(movimiento.fechaCreacion);
  let montoEnviado;

  switch (movimiento.moneda) {
    case "ARS":
      montoEnviado = movimiento.total.ars;
      break;
    case "USD BLUE":
      montoEnviado = movimiento.total.usdBlue;
      break;
    case "USD OFICIAL":
      montoEnviado = movimiento.total.usdOficial;
  }

  let montoCC;
  switch (movimiento.cuentaCorriente) {
    case "ARS":
      montoCC = movimiento.total.ars;
      break;
    case "USD BLUE":
      montoCC = movimiento.total.usdBlue;
      break;
    case "USD OFICIAL":
      montoCC = movimiento.total.usdOficial;
  }
  return [
    movimiento.numeroFactura,
    fecha.toISOString().split("T")[0],
    fecha.toTimeString().split(" ")[0],
    movimiento.cliente.nombre.toUpperCase(),
    movimiento.caja.nombre,
    montoEnviado,
    montoCC,
    movimiento.cuentaCorriente,
    movimiento.tipoDeCambio,
    movimiento.estado,
    movimiento.imagen ?? "",
    movimiento.nombreUsuario,
    "-",
    "-",
    movimiento.cuentaCorriente === "ARS" ? montoCC : "",
    movimiento.cuentaCorriente === "USD BLUE" ? montoCC : "",
    movimiento.cuentaCorriente === "USD OFICIAL" ? montoCC : "",
    montoEnviado,
    movimiento.moneda,
    movimiento.moneda === "ARS" ? montoEnviado : "",
    movimiento.moneda === "USD" ? montoEnviado : "",
    "",
    movimiento.caja.nombre,
    movimiento._id,
  ];
}

function getTitlesToSheetGeneral() {
  return [
    "Número Comprobante",
    "Fecha",
    "Hora",
    "Cliente",
    "Cuenta de destino",
    "Monto enviado",
    "Monto",
    "Moneda",
    "Tipo de cambio",
    "Estado",
    "Imagen",
    "Usuario",
  ];
}

const parseComprobantes = (arr) => {
  const comprobantes = arr.map((row) => ({
    numero_comprobante: row[0],
    fecha: row[1],
    hora: row[2],
    cliente: row[3],
    destino: row[4],
    montoEnviado: row[5],
    monto: row[6], //montoCC
    moneda: row[7],
    tipoDeCambio: row[8],
    estado: row[9],
    imagen: row[10],
    usuario: row[11],
    monedaDePago: row[18],
    id: row[23],
  }));
  return comprobantes;
};

const formatearCuentasCorrientes = (ccActivas) => {
  if (!ccActivas) return [];
  return ccActivas.split(", ").filter((cc) => cc.trim() !== "");
};

async function getNextId(GOOGLE_SHEET_ID) {
  try {
    const lastRow = await getLastRow(GOOGLE_SHEET_ID, "ComprobanteRAW");
    console.log("lastRow", lastRow);

    if (lastRow <= 1) {
      return "C1";
    }

    const lastRowData = await getRowsValues(
      GOOGLE_SHEET_ID,
      "ComprobanteRAW",
      `X${lastRow}:X${lastRow}`
    );
    console.log("lastRowData", lastRowData);

    const lastId = lastRowData[0][0];
    const lastIdNumber = lastId.split("C")[1];

    const lastNumber = parseInt(lastIdNumber);
    const nextNumber = lastNumber + 1;

    const nextId = `C${nextNumber}`;

    return nextId;
  } catch (error) {
    console.error("Error al obtener el siguiente ID:", error);
    throw error;
  }
}

async function addMovimientoToSheet(movimiento, GOOGLE_SHEET_ID) {
  const headers = getTitlesToSheetGeneral();
  const values = await getArrayFromMongoToSheet(movimiento);
  await addRow(GOOGLE_SHEET_ID, values, general_range, headers);
}

async function addComprobanteToSheet(comprobante, GOOGLE_SHEET_ID) {
  try {
    const nextId = await generarUUIDConTimestamp();
    comprobante.id = nextId;

    const headers = getTitlesToSheetGeneral();
    const values = await getArrayToSheetGeneral(comprobante);
    await addRow(GOOGLE_SHEET_ID, values, general_range, headers);
    const result = await addComprobanteToMongo(comprobante);
    return result;
  } catch (error) {
    console.error(
      "Error al agregar comprobante:",
      error?.message || error,
      error?.cause ? `\nCausa: ${error.cause?.message || error.cause}` : ""
    );
    throw error;
  }
}

async function addComprobanteToMongo(comprobante) {
  const [dia, mes, año] = comprobante.fecha.split("/");

  const caja = await cajaController.getByNombre(comprobante.destino);
  const cliente = await clienteController.getByNombre(comprobante.cliente);

  const clienteParsed = {
    ...cliente.data,
    nombre: cliente?.data?.nombre || comprobante.cliente,
  };

  const fechaFactura = new Date(año, mes - 1, dia, 14, 0, 0);
  const movimientoDataToController = {
    type: "INGRESO",
    numeroFactura: comprobante.numero_comprobante,
    fechaFactura: fechaFactura,
    clienteId: cliente.success ? cliente.data._id : null,
    cliente: {
      nombre: clienteParsed?.nombre || comprobante.cliente,
      ccActivas: cliente.success ? cliente.data.ccActivas : [],
      descuento: cliente.success ? cliente.data.descuento : 0,
    },
    cuentaCorriente: comprobante.moneda,
    moneda: "ARS",
    tipoFactura: comprobante.destino === "CHEQUE" ? "cheque" : "transferencia",
    caja: caja?.data?._id,
    urlImagen: comprobante.imagen,
    estado: "PENDIENTE",
    nombreUsuario: comprobante.usuario,
    empresaId: "celulandia",
    tipoDeCambio: Number(comprobante.tipoDeCambio) || null,
  };
  const montoEnviadoToController = comprobante.montoEnviado;
  const result = await MovimientoController.createMovimiento(
    movimientoDataToController,
    montoEnviadoToController
  );

  if (result.success) {
    return result.data;
  }
  const baseMsg =
    (result && result.error && result.error.message) ||
    (typeof result?.error === "string"
      ? result.error
      : JSON.stringify(result?.error));
  const err = new Error(
    `Error al agregar comprobante a la base de datos: ${baseMsg}`
  );
  // Adjuntar causa para depuración aguas arriba
  err.cause = result?.error;
  throw err;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function updateComprobanteToSheet(matchs, GOOGLE_SHEET_ID) {
  for (const match of matchs) {
    let values = await getArrayToSheetGeneral(match.comprobante);
    await updateRow(
      GOOGLE_SHEET_ID,
      values,
      general_range,
      0,
      match.comprobante.numero_comprobante
    );
    await sleep(1000);
  }
}

async function getUltimosComprobantesFromSheet(GOOGLE_SHEET_ID) {
  const dataComprobantes = await getRowsValues(
    GOOGLE_SHEET_ID,
    "ComprobanteRAW",
    "A480:M100000"
  );
  return dataComprobantes;
}

async function getComprobantesFromSheet(GOOGLE_SHEET_ID) {
  const dataComprobantes = await getRowsValues(
    GOOGLE_SHEET_ID,
    "ComprobanteRAW",
    "A2:X100000"
  );
  const comprobantesRAW = parseComprobantes(dataComprobantes);

  return comprobantesRAW;
}

async function esDuplicado(comprobante, GOOGLE_SHEET_ID) {
  try {
    const ultimosComprobantes = await getUltimosComprobantesFromSheet(
      GOOGLE_SHEET_ID
    );
    const comprobantesParsed = parseComprobantes(ultimosComprobantes);

    const normalizarMonto = (monto) => {
      if (typeof monto === "string") {
        return parseFloat(monto.replace("$", "").replace(/\./g, ""));
      }
      return monto;
    };

    const duplicadoExacto = comprobantesParsed.find(
      (c) =>
        c.numero_comprobante === comprobante.numero_comprobante &&
        c.fecha === comprobante.fecha &&
        c.hora === comprobante.hora &&
        normalizarMonto(c.montoEnviado) ===
          normalizarMonto(comprobante.montoEnviado)
    );

    if (duplicadoExacto) {
      return { status: "DUPLICADO" };
    }
    console.log("comprobanteEnviado", comprobante);
    const posibleDuplicado = comprobantesParsed.find(
      (c) =>
        (normalizarMonto(c.monto) === normalizarMonto(comprobante.monto) &&
          c.fecha === comprobante.fecha &&
          c.hora === comprobante.hora) ||
        (c.numero_comprobante === comprobante.numero_comprobante &&
          normalizarMonto(c.montoEnviado) ===
            normalizarMonto(comprobante.montoEnviado))
    );

    if (posibleDuplicado) {
      return {
        status: "POSIBLE DUPLICADO",
        comprobante: posibleDuplicado,
      };
    }

    return { status: "NO DUPLICADO" };
  } catch (error) {
    console.error("Error al verificar duplicados:", error);
    return "NO DUPLICADO"; // En caso de error, permitimos continuar
  }
}

module.exports = {
  addComprobanteToSheet,
  updateComprobanteToSheet,
  parseComprobantes,
  getComprobantesFromSheet,
  getUltimosComprobantesFromSheet,
  esDuplicado,
  formatearCuentasCorrientes,
  getNextId,
  addMovimientoToSheet,
};
