const FlowManager = require("../../../FlowControl/FlowManager");
const opcionElegida = require("../../../Utiles/Chatgpt/opcionElegida");
const ConciliacionFlow = require("../../Conciliacion/ConciliacionFlow");

module.exports = async function ElegirTipoExcelStep(userId, message, sock) {
  const flowData = FlowManager.userFlows[userId].flowData;
  const data = await opcionElegida(message);

  if (data.data.Eleccion == "1") {
    ConciliacionFlow.start(userId, flowData, sock);
  } else if (data.data.Eleccion == "2") {
  } else if (data.data.Eleccion == "3") {
    await sock.sendMessage(userId, {
      text: "❌ Has cancelado el proceso de confirmación.",
    });
  } else {
    await sock.sendMessage(userId, { text: "Disculpa, no lo he entendido" });
  }
};
