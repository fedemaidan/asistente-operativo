const general_range = "ComprobanteRAW!A1:X100000";
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
    comprobante.cliente.toUpperCase(),
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
    monto: row[6],
    moneda: row[7],
    tipoDeCambio: row[8],
    estado: row[9],
    imagen: row[10],
    usuario: row[11],
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

async function addComprobanteToSheet(comprobante, GOOGLE_SHEET_ID) {
  try {
    const nextId = await generarUUIDConTimestamp();
    comprobante.id = nextId;

    const headers = getTitlesToSheetGeneral();
    const values = await getArrayToSheetGeneral(comprobante);
    await addRow(GOOGLE_SHEET_ID, values, general_range, headers);

    // console.log(`Comprobante agregado con ID: ${nextId}`);
    // return nextId;
    return "";
  } catch (error) {
    console.error("Error al agregar comprobante:", error);
    throw error;
  }
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
    "A2:M100000"
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
};
