const FlowManager = require("../../../FlowControl/FlowManager");
const analizarCliente = require("../../../Utiles/Chatgpt/analizarCliente");

module.exports = async function ElegirCliente(userId, message, sock) {
  const cliente = await analizarCliente(message);
  const comprobante = FlowManager.userFlows[userId].flowData.data;

  console.log("cliente", cliente);
  console.log("comprobante", comprobante);

  //TODO: cuenta de destino
  const mensaje = `📌 *Confirmación de Datos* 📌\nPara procesar tu solicitud, necesitamos que confirmes los siguientes datos de la transferencia:\n🔹 *Número de comprobante:* ${comprobante.numero_comprobante}\n🔹 *Fecha:* ${comprobante.fecha}\n🔹 *Hora:* ${comprobante.hora}\n🔹 *Cuenta de origen:* ${comprobante.nombre} ${comprobante.apellido}\n🔹 *Cliente*: ${cliente.nombre} ${cliente.apellido}\n🔹 *Cuenta de destino:* SorbyData\n🔹 *Monto:* $${comprobante.monto}\n🔹 *Moneda:* ${cliente.cc}\n🔹 *CUIT:* ${comprobante.cuit}\n\n⚠️ *Por favor, revisa que los datos sean correctos.`;

  await sock.sendMessage(userId, {
    text: mensaje,
  });

  await sock.sendMessage(userId, {
    text: "¿Los datos son correctos? Indiqué con el número su respuesta.\n\n*1.* ✅ *Si*\n*2.* 📝 *No, quiero corregirlo.*\n*3.* ❌ *Cancelar, voy a pedirlo nuevamente.*",
  });

  comprobante.estado = "PENDIENTE";
  comprobante.monto = parseFloat(comprobante.monto);
  comprobante.cliente = `${cliente.nombre} ${cliente.apellido}`;
  comprobante.destino = "Sorby Data";
  comprobante.cc = cliente.cc;

  console.log("comprobante original", comprobante);

  FlowManager.setFlow(
    userId,
    "ENVIOCOMPROBANTE",
    "ValidacionDatos",
    comprobante
  );
};
