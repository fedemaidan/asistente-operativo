const FlowManager = require("../../../FlowControl/FlowManager");
const opcionElegida = require("../../../Utiles/Chatgpt/opcionElegida");
const {
  addComprobanteToSheet,
} = require("../../../Utiles/GoogleServices/Sheets/comprobante");

module.exports = async function ValidacionDatos(userId, message, sock) {
  const data = await opcionElegida(message);

  const { cliente, comprobante } = FlowManager.userFlows[userId].flowData;

  if (data.data.Eleccion == "1") {
    await sock.sendMessage(userId, { text: "🔄 Procesando..." });

    console.log("cliente", cliente);
    console.log("comprobante", comprobante);
    console.log("data", data);

    comprobante.estado = "PENDIENTE";
    comprobante.monto = parseFloat(comprobante.monto);
    comprobante.cliente = `${cliente.nombre} ${cliente.apellido}`;
    comprobante.destino = "Sorby Data";
    comprobante.cc = cliente.cc;

    //TODO: manejar errores
    await addComprobanteToSheet(comprobante);

    FlowManager.resetFlow(userId);
    await sock.sendMessage(userId, {
      text: `✅ *Comprobante enviado correctamente. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing*`,
    });
  } else if (data.data.Eleccion == "2") {
    // await sock.sendMessage(userId, {
    //   text: "✏️ Por favor, revisa los datos y dinos donde esta el error.\n\nEjemplo: El monto es incorrecto, debería ser $10.000 en lugar de $9.500.",
    // });
    await sock.sendMessage(userId, {
      text: "En desarrollo ...",
    });
    FlowManager.resetFlow(userId);
  } else if (message == "3") {
    await sock.sendMessage(userId, {
      text: "❌ Has cancelado el proceso de confirmación.",
    });
    FlowManager.resetFlow(userId);
  } else {
    await sock.sendMessage(userId, { text: "Disculpa, no lo he entendido" });
  }
};
