const FlowManager = require("../../../FlowControl/FlowManager");
const analizarCliente = require("../../../Utiles/Chatgpt/analizarCliente");

module.exports = async function ElegirCliente(userId, message, sock) {
  const cliente = await analizarCliente(message);
  const data = FlowManager.userFlows[userId].flowData.data;

  //TODO: cuenta de destino
  const mensaje = `📌 *Confirmación de Datos* 📌\nPara procesar tu solicitud, necesitamos que confirmes los siguientes datos de la transferencia:\n🔹 *Número de comprobante:* ${data.numero_comprobante}\n🔹 *Fecha:* ${data.fecha}\n🔹 *Hora:* ${data.hora}\n🔹 *Cuenta de origen:* ${data.nombre} ${data.apellido}\n🔹 *Cliente*: ${cliente.nombre} ${cliente.apellido}\n🔹 *Cuenta de destino:* SorbyData\n🔹 *Monto:* $${data.monto}\n🔹 *Moneda:* ${cliente.cc}\n🔹 *CUIT:* ${data.cuit}\n\n⚠️ *Por favor, revisa que los datos sean correctos.`;

  await sock.sendMessage(userId, {
    text: mensaje,
  });

  await sock.sendMessage(userId, {
    text: "¿Los datos son correctos? Indiqué con el número su respuesta.\n\n*1.* ✅ *Si*\n*2.* 📝 *No, quiero corregirlo.*\n*3.* ❌ *Cancelar, voy a pedirlo nuevamente.*",
  });

  FlowManager.setFlow(userId, "ENVIOCOMPROBANTE", "ValidacionDatos", {
    comprobante: data,
    cliente,
  });
};
