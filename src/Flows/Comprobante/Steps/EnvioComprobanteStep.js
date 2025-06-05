const FlowManager = require("../../../FlowControl/FlowManager");
const botSingleton = require("../../../Utiles/botSingleton");

module.exports = async function EnvioComprobanteStep(userId, data) {
  const sock = botSingleton.getSock();
  try {
    console.log("🚀 EnvioComprobante - Datos recibidos");
    const mensaje = `📌 *Confirmación de Datos* 📌\n\n👤 *Por favor, indícanos a qué cliente pertenece la transferencia y en que moneda se realizó la operación(Pesos, Dólares, etc.)*`;

    await sock.sendMessage(userId, { text: mensaje });

    FlowManager.setFlow(userId, "ENVIOCOMPROBANTE", "ElegirClienteStep", {
      data,
    });
  } catch (error) {
    console.error("❌ Error en PrimeraEleccionEntrega:", error);
    FlowManager.resetFlow(userId);
  }
};
