const opcionElegida = require("../../../Utiles/Chatgpt/opcionElegida");
const getClientesFromSheet = require("../../../Utiles/Funciones/Clientes/getClientesFromSheet");
const FlowManager = require("../../../FlowControl/FlowManager");

module.exports = async function ValidacionComprobante(userId, message, sock) {
  const data = await opcionElegida(message);

  if (data.data.Eleccion == "1") {
    const clientes = await getClientesFromSheet();
    console.log(clientes);
    const mensaje = `📌 *Confirmación de Cliente* 📌\nPara procesar tu solicitud, necesitamos que confirmes a que cliente pertenece el comprobante:\n
    \n${clientes
      .map(
        (cliente, index) =>
          `*${index}.* ${cliente.nombre} ${cliente.apellido} - CC ${cliente.cc}`
      )
      .join("\n")}
    `;

    await sock.sendMessage(userId, {
      text: mensaje,
    });

    FlowManager.setFlow(userId);

    FlowManager.setFlow(userId, "ENVIOCOMPROBANTE", "ElegirCliente", {
      ...FlowManager.userFlows[userId].flowData,
      clientes: clientes,
    });
  } else if (data.data.Eleccion == "2") {
    await sock.sendMessage(userId, {
      text: "✏️ Por favor, revisa los datos de tu comprobante y dinos si hay algún error.\n\nEjemplo: El monto es incorrecto, debería ser $10.000 en lugar de $9.500.",
    });
    FlowManager.setFlow(
      userId,
      "ENVIOCOMPROBANTE",
      "ModificarComprobante",
      FlowManager.userFlows[userId]?.flowData
    );
  } else if (data.data.Eleccion == "3") {
    await sock.sendMessage(userId, {
      text: "❌ Has cancelado el proceso de confirmación.",
    });

    FlowManager.resetFlow(userId);
  } else {
    await sock.sendMessage(userId, { text: "Disculpa, no lo he entendido" });
  }
};
