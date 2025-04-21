const { getRowsValues } = require("../../GoogleServices/General");
const {
  parseComprobantes,
  parseJsonToInfoBanco,
  getBancoMatchs,
} = require("./excelBanco");

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

module.exports = async function analizarExcel(data, type) {
  if (type == "BANCO") {
    const dataComprobantes = await getRowsValues(
      GOOGLE_SHEET_ID,
      "ComprobanteRAW",
      "A2:M1000"
    );
    const comprobantesRAW = parseComprobantes(dataComprobantes);
    const movimientosBanco = parseJsonToInfoBanco(data);

    const matchs = getBancoMatchs(comprobantesRAW, movimientosBanco);

    return matchs;
  }
};
