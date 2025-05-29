const general_range = "ComprobanteRAW!A1:U100000";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const { addRow, updateRow, getRowsValues } = require("../General");

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
    "-",
    "-",
    "-",
    comprobante.moneda === "ARS" ? comprobante.monto : "",
    comprobante.moneda === "USD BLUE" ? comprobante.monto : "",
    comprobante.moneda === "USD OFICIAL" ? comprobante.monto : "",
    comprobante.monto,
    "ARS", // Siempre se reciben pesos
    comprobante.montoEnviado,
    0,
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
  ];
}

const parseComprobantes = (arr) =>
  arr.map((row) => ({
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
  }));

async function addComprobanteToSheet(comprobante) {
  const headers = getTitlesToSheetGeneral();
  const values = await getArrayToSheetGeneral(comprobante);
  await addRow(GOOGLE_SHEET_ID, values, general_range, headers);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function updateComprobanteToSheet(matchs) {
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

async function getComprobantesFromSheet() {
  const dataComprobantes = await getRowsValues(
    GOOGLE_SHEET_ID,
    "ComprobanteRAW",
    "A2:M1000"
  );
  const comprobantesRAW = parseComprobantes(dataComprobantes);

  return comprobantesRAW;
}

module.exports = {
  addComprobanteToSheet,
  updateComprobanteToSheet,
  parseComprobantes,
  getComprobantesFromSheet,
};
