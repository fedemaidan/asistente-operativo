const FlowManager = require("../../../FlowControl/FlowManager");
const botSingleton = require("../../../Utiles/botSingleton");

const FLOW_NAME = "VERIFICAR_REMITENTE";

module.exports = async function InicioVerificacionStep(userId) {
  const sock = botSingleton.getSock();
  try {
    await sock.sendMessage(userId, {
      text:
        "No tenemos tu numero vinculado al bot todavía.\n\n" +
        "Enviá tu *número de teléfono* tal como está registrado en el sistema (solo dígitos, con código de país). Ej: 5491126475034 ",
    });
    FlowManager.setFlow(userId, FLOW_NAME, "ProcesarTelefonoStep", {});
  } catch (error) {
    console.error("InicioVerificacionStep:", error?.message || error);
    FlowManager.resetFlow(userId);
  }
};
