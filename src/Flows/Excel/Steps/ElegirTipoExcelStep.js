const FlowManager = require("../../../FlowControl/FlowManager");
const opcionElegida = require("../../../Utiles/Chatgpt/opcionElegida");
const {
  parseJsonBancoToMovimiento,
  parseJsonFinancieraToMovimiento,
} = require("../../../Utiles/Funciones/Excel/excelMovimientos");
const ConciliacionFlow = require("../../Conciliacion/ConciliacionFlow");
const StockFlow = require("../../Stock/StockFlow");

module.exports = async function ElegirTipoExcelStep(userId, message, sock) {
  const { excelJson, fileName } = FlowManager.userFlows[userId].flowData;
  const data = await opcionElegida(message);

  if (data.data.Eleccion == "1") {
    const movimientosExcel = parseJsonBancoToMovimiento(excelJson, fileName);
    ConciliacionFlow.start(userId, movimientosExcel, sock);
  } else if (data.data.Eleccion == "2") {
    const movimientosExcel = parseJsonFinancieraToMovimiento(excelJson);
    console.log("MOVIMIENTOS EXCEL FINANCIERA", movimientosExcel);
    ConciliacionFlow.start(userId, movimientosExcel, sock);
  } else if (data.data.Eleccion == "3") {
    StockFlow.start(userId, excelJson, sock);
  } else if (data.data.Eleccion == "4") {
    await sock.sendMessage(userId, {
      text: "Cancelando Operacion.",
    });
    FlowManager.resetFlow(userId);
  } else {
    console.log("opcionElegida", opcionElegida);
    await sock.sendMessage(userId, {
      text: "❓ *Opción no reconocida*\n\nPor favor, seleccione una opción válida respondiendo con un número:\n\n*1.* 🏦 Reporte Banco\n*2.* 💰 Reporte Financiera\n*3.* 🧾 Reporte Stock\n*4.* ❌ Cancelar",
    });
  }
};
