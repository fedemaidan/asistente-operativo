const ModificarComprobanteGpt = require("../../../Utiles/Funciones/ModificarComprobante");
const FlowManager = require("../../../FlowControl/FlowManager");

module.exports = async function ModificarDatos(userId, message, sock) {
  try {
    const data = await ModificarComprobanteGpt(message, userId);

    if (!data) {
      await sock.sendMessage(userId, {
        text: "❌ Error al procesar la modificación. Por favor, intenta nuevamente.",
      });
      return;
    }
    console.log("comprobante modificado", data);
    const mensaje = `📌 *Confirmación de Datos* 📌\nPor favor, necesitamos que confirmes los siguientes datos que modificamos de la transferencia:\n🔹 *Número de comprobante:* ${data.numero_comprobante}\n🔹 *Fecha:* ${data.fecha}\n🔹 *Hora:* ${data.hora}\n🔹 *Cuenta de origen:* ${data.nombre} ${data.apellido}\n🔹 *Cliente*: ${data.cliente}\n🔹 *Cuenta de destino:* ${data.destino}\n🔹 *Monto:* $${data.monto}\n🔹 *Moneda:* ${data.cc}\n🔹 *CUIT:* ${data.cuit}\n\n⚠️ *Por favor, revisa que los datos sean correctos.`;
    await sock.sendMessage(userId, {
      text: mensaje,
    });

    await sock.sendMessage(userId, {
      text: "¿Los datos son correctos? Indique con el número su respuesta.\n\n*1.* ✅ *Si*\n*2.* 📝 *No, quiero corregirlo.*\n*3.* ❌ *Cancelar, voy a pedirlo nuevamente.*",
    });

    FlowManager.setFlow(userId, "ENVIOCOMPROBANTE", "ValidacionDatos", data);
  } catch (error) {
    console.error("❌ Error en ModificarComprobante:", error);
  }
};
