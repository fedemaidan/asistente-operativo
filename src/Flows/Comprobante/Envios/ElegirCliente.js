const getClientesFromSheet = require("../../../Utiles/Funciones/Clientes/getClientesFromSheet");
const FlowManager = require("../../../FlowControl/FlowManager");

module.exports = async function ElegirCliente(userId, message, sock) {
  const data = FlowManager.userFlows[userId].flowData.clientes;
  console.log("data", data);
  console.log("message", message);

  if (message >= 0 && message < data.length) {
    const clienteElegido = data[message];
    const mensaje = `📌 *Confirmación de Cliente* 📌\nHas elegido al cliente: \n*${clienteElegido.nombre} ${clienteElegido.apellido} - ${clienteElegido.cuit}*\n\n⚠️ *Por favor, verifica si ha seleccionado el cliente correcto.*\nIndiqué con el número su respuesta.\n\n*1.* ✅ *Si*\n*2.* 📝 *No, quiero corregirlo.*\n*3.* ❌ *Cancelar, voy a pedirlo nuevamente.*.`;

    await sock.sendMessage(userId, { text: mensaje });
    FlowManager.setFlow(userId, "ENVIOCOMPROBANTE", "ValidacionCliente", {
      ...FlowManager.userFlows[userId].flowData,
      clienteElegido,
    });
  } else {
    await sock.sendMessage(userId, {
      text: "❌ Opción inválida. Por favor, selecciona un cliente de la lista.",
    });
  }
};
