const ModificarComprobanteGpt = require("../../../Utiles/Funciones/ModificarComprobante");
const FlowManager = require("../../../FlowControl/FlowManager");
const {
  formatCurrency,
} = require("../../../Utiles/Funciones/Moneda/formatCurrency");
const CURRENCY_DISPLAY = require("../../../Utiles/Funciones/Moneda/CurrencyDisplay");
const botSingleton = require("../../../Utiles/botSingleton");

module.exports = async function ModificarDatosStep(userId, message) {
  const sock = botSingleton.getSock();
  try {
    await sock.sendMessage(userId, { text: "⏳ Analizando mensaje ⏳" });

    const data = await ModificarComprobanteGpt(message, userId);

    if (!data) {
      await sock.sendMessage(userId, {
        text: "❌ Error al procesar la modificación. Por favor, intenta nuevamente.",
      });
      return;
    }

    console.log("DATA", data);

    const mensaje =
      `📌 *Confirmación de Datos* 📌\n\n` +
      `Por favor, necesitamos que confirmes los siguientes datos que modificamos de la transferencia:\n\n` +
      `🔹 *Número de comprobante:* ${data.numero_comprobante}\n` +
      `🔹 *Fecha:* ${data.fecha}\n` +
      `🔹 *Hora:* ${data.hora}\n` +
      `🔹 *Cliente*: ${data.cliente}\n` +
      `🔹 *Cuenta Corriente:* ${data.cuentaCorriente ? "Sí" : "No"}\n` +
      `🔹 *Cuenta de destino:* ${data.destino}\n` +
      `🔹 *Monto:* ${formatCurrency(data.montoEnviado)}\n` +
      `🔹 *Moneda:* ${CURRENCY_DISPLAY[data.moneda]}`;

    await sock.sendMessage(userId, {
      text: mensaje,
    });

    await sock.sendMessage(userId, {
      text: "¿Los datos son correctos? Indique con el número su respuesta.\n\n*1.* ✅ *Si*\n*2.* 📝 *No, quiero corregirlo.*\n*3.* ❌ *Cancelar, voy a pedirlo nuevamente.*",
    });

    FlowManager.setFlow(
      userId,
      "ENVIOCOMPROBANTE",
      "ValidacionDatosStep",
      data
    );
  } catch (error) {
    console.error("❌ Error en ModificarComprobante:", error);
    FlowManager.resetFlow(userId);
  }
};
