const FlowManager = require("../../../FlowControl/FlowManager");
const botSingleton = require("../../../Utiles/botSingleton");
const {
  parseJsonBancoToMovimiento,
  parseNewJsonFinancieraToMovimiento,
  parseJsonFinancieraToMovimiento,
} = require("../../../Utiles/Funciones/Excel/excelMovimientos");
const ConciliacionFlow = require("../../Conciliacion/ConciliacionFlow");
const StockFlow = require("../../Stock/StockFlow");

module.exports = async function ElegirTipoExcelStep(userId, message) {
  const sock = botSingleton.getSock();
  const { excelJson, fileName, driveUrl } =
    FlowManager.userFlows[userId].flowData;

  if (message == "1") {
    console.log("file name", fileName);
    const movimientosExcel = parseJsonBancoToMovimiento(excelJson, fileName);
    console.log("movimientosExcel", movimientosExcel);
    ConciliacionFlow.start(userId, movimientosExcel);
  } else if (message == "2") {
    const movimientosExcel = parseNewJsonFinancieraToMovimiento(excelJson);
    ConciliacionFlow.start(userId, movimientosExcel);
  } else if (message == "3") {
    StockFlow.start(userId, { excelJson, driveUrl });
  } else if (message == "4") {
    await sock.sendMessage(userId, {
      text: "❌ Has cancelado el proceso de confirmación.",
    });
    FlowManager.resetFlow(userId);
  } else {
    await sock.sendMessage(userId, {
      text: "❓ *Opción no reconocida*\n\nPor favor, seleccione una opción válida respondiendo con un número:\n\n*1.* 🏦 Reporte Banco\n*2.* 💰 Reporte Financiera\n*3.* 🧾 Reporte Stock\n*4.* ❌ Cancelar",
    });
  }
};
