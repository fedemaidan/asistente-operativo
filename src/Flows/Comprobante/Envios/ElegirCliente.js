const FlowManager = require("../../../FlowControl/FlowManager");
const analizarCliente = require("../../../Utiles/Chatgpt/analizarCliente");
const { formatCurrency } = require("../../../Utiles/Funciones/formatCurrency");

module.exports = async function ElegirCliente(userId, message, sock) {
  await sock.sendMessage(userId, {
    text: "⏳*Analizando mensaje...*⏳",
  });
  const cliente = await analizarCliente(message);
  const comprobante = FlowManager.userFlows[userId].flowData.data;

  //TODO: cuenta de destino
  const mensaje = `📌 *Confirmación de Datos* 📌\nPara procesar tu solicitud, necesitamos que confirmes los siguientes datos de la transferencia:\n🔹 *Número de comprobante:* ${
    comprobante.numero_comprobante
  }\n🔹 *Fecha:* ${comprobante.fecha}\n🔹 *Hora:* ${
    comprobante.hora
  }\n🔹 *Cuenta de origen:* ${comprobante.nombre} ${
    comprobante.apellido
  }\n🔹 *Cliente*: ${cliente.nombre}\n🔹 *Cuenta de destino:* ${
    comprobante.destino
  }\n🔹 *Monto:* ${formatCurrency(comprobante.monto, "ARS")}\n🔹 *Moneda:* ${
    cliente.moneda
  }\n🔹 *CUIT:* ${
    comprobante.cuit
  }\n\n⚠️ *Por favor, revisa que los datos sean correctos.`;

  await sock.sendMessage(userId, {
    text: mensaje,
  });

  await sock.sendMessage(userId, {
    text: "¿Los datos son correctos? Indiqué con el número su respuesta.\n\n*1.* ✅ *Si*\n*2.* 📝 *No, quiero corregirlo.*\n*3.* ❌ *Cancelar, voy a pedirlo nuevamente.*",
  });

  comprobante.estado = "PENDIENTE";
  comprobante.monto = parseFloat(comprobante.monto);
  comprobante.cliente = cliente.nombre;
  comprobante.moneda = cliente.moneda;

  FlowManager.setFlow(
    userId,
    "ENVIOCOMPROBANTE",
    "ValidacionDatos",
    comprobante
  );
};
