const FlowManager = require("../../../FlowControl/FlowManager");
const opcionElegida = require("../../../Utiles/Chatgpt/opcionElegida");
const {
  addComprobanteToSheet,
} = require("../../../Utiles/GoogleServices/Sheets/comprobante");
const {
  addClienteComprobanteToSheet,
} = require("../../../Utiles/GoogleServices/Sheets/cliente");
const DolarService = require("../../../Utiles/Funciones/dolarService");

module.exports = async function ValidacionDatos(userId, message, sock) {
  const data = await opcionElegida(message);

  const comprobante = FlowManager.userFlows[userId].flowData;

  console.log("comprobante", comprobante);

  if (data.data.Eleccion == "1") {
    await sock.sendMessage(userId, { text: "🔄 Procesando..." });

    console.log("comprobante", comprobante);

    if (comprobante.moneda !== "ARS") {
      dolarValue = await DolarService.dameValorDelDolar(comprobante.moneda);
      comprobante.monto = parseInt(comprobante.monto / dolarValue);
      comprobante.tipoDeCambio = dolarValue;
    } else {
      comprobante.monto = parseFloat(comprobante.monto);
      comprobante.tipoDeCambio = "-";
    }

    comprobante.moneda = CURRENCY_DISPLAY[comprobante.moneda];

    await addComprobanteToSheet(comprobante);
    await addClienteComprobanteToSheet(comprobante);

    FlowManager.resetFlow(userId);
    await sock.sendMessage(userId, {
      text: `✅ *Comprobante enviado correctamente. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing*`,
    });
  } else if (data.data.Eleccion == "2") {
    await sock.sendMessage(userId, {
      text: "✏️ Por favor, revisa los datos y dinos donde esta el error.\n\nEjemplo: El monto es incorrecto, debería ser $10.000 en lugar de $9.500.",
    });

    console.log("COMPROBANTE", comprobante);

    FlowManager.setFlow(
      userId,
      "ENVIOCOMPROBANTE",
      "ModificarDatos",
      comprobante
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
