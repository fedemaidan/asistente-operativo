const FlowManager = require("../../../FlowControl/FlowManager");
const opcionElegida = require("../../../Utiles/Chatgpt/opcionElegida");
const {
  parseJsonBancoToMovimiento,
  parseJsonFinancieraToMovimiento,
} = require("../../../Utiles/Funciones/Excel/excelMovimientos");
const ConciliacionFlow = require("../../Conciliacion/ConciliacionFlow");
const StockFlow = require("../../Stock/StockFlow");

module.exports = async function ElegirTipoExcelStep(userId, message, sock) {
  const flowData = FlowManager.userFlows[userId].flowData;
  const data = await opcionElegida(message);

  if (data.data.Eleccion == "1") {
    //parseJsonBancoToMovimientoBancario
    const movimientosExcel = parseJsonBancoToMovimiento(flowData);
    ConciliacionFlow.start(userId, movimientosExcel, sock);
  } else if (data.data.Eleccion == "2") {
    const movimientosExcel = parseJsonFinancieraToMovimiento(flowData);
    ConciliacionFlow.start(userId, movimientosExcel, sock);
  } else if (data.data.Eleccion == "3") {
    StockFlow.start(userId, flowData, sock);
  } else if (data.data.Eleccion == "4") {
    await sock.sendMessage(userId, {
      text: "Cancelando Operacion.",
    });
  } else {
    await sock.sendMessage(userId, { text: "Disculpa, no lo he entendido" });
  }
};
