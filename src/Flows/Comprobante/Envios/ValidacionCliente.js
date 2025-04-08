const FlowManager = require("../../../FlowControl/FlowManager");
const {
  addComprobanteToSheet,
} = require("../../../Utiles/GoogleServices/Sheets/comprobante");

module.exports = async function ValidacionCliente(userId, message, sock) {
  //TODO: chatgpt para detectar de que cliente habla el usuario
  //const data = await opcionElegida(message);
  const { clienteElegido, clientes, ...comprobante } =
    FlowManager.userFlows[userId].flowData;

  if (message == "1") {
    await sock.sendMessage(userId, {
      text: "✅ *Cliente confirmado correctamente.*",
    });

    await sock.sendMessage(userId, { text: "🔄 Procesando..." });

    comprobante.estado = "PENDIENTE";
    comprobante.monto = parseInt(comprobante.monto);
    comprobante.cliente = `${clienteElegido.nombre} ${clienteElegido.apellido}`;
    comprobante.cc = clienteElegido.cc;

    await addComprobanteToSheet(comprobante);

    await sock.sendMessage(userId, {
      text: `✅ *Comprobante enviado correctamente. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing*`,
    });
  } else if (message == "2") {
    const mensaje = `📌 *Confirmación de Cliente* 📌
  
    Para procesar tu solicitud, necesitamos que confirmes a que cliente pertenece el comprobante:
  
    ${clientes
      .map(
        (cliente, index) =>
          `*${index}.* ${cliente.nombre} ${cliente.apellido} - ${cliente.cuit} `
      )
      .join("\n")}
    ⚠️ *Por favor, revisa que los datos sean correctos.* Si hay algún error, envíanos la información correcta.
    `;

    await sock.sendMessage(userId, {
      text: "✏️ Por favor, vuelve a elegir el cliente",
    });

    await sock.sendMessage(userId, { text: mensaje });

    FlowManager.setFlow(
      userId,
      "ENVIOCOMPROBANTE",
      "ElegirCliente",
      FlowManager.userFlows[userId]?.flowData
    );
  } else if (message == "3") {
    await sock.sendMessage(userId, {
      text: "❌ Has cancelado el proceso de confirmación.",
    });
    FlowManager.resetFlow(userId);
  } else {
    await sock.sendMessage(userId, { text: "Disculpa, no lo he entendido" });
  }
};
