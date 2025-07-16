const FlowManager = require("../../../FlowControl/FlowManager");
const opcionElegida = require("../../../Utiles/Chatgpt/opcionElegida");
const {
  addComprobanteToSheet,
  esDuplicado,
} = require("../../../Utiles/GoogleServices/Sheets/comprobante");
const DolarService = require("../../../Utiles/Funciones/Moneda/dolarService");
const botSingleton = require("../../../Utiles/botSingleton");
const {
  formatCurrency,
} = require("../../../Utiles/Funciones/Moneda/formatCurrency");
const CURRENCY_DISPLAY = require("../../../Utiles/Funciones/Moneda/CurrencyDisplay");

module.exports = async function ValidacionDatosStep(userId, message) {
  const sock = botSingleton.getSock();
  const GOOGLE_SHEET_ID = botSingleton.getSheetIdByUserId(userId);
  const comprobante = FlowManager.userFlows[userId].flowData;

  const usuarios = botSingleton.getUsuarioByUserId(userId);
  const opcionCorregir =
    usuarios.length === 1 ? "2" : (usuarios.length + 1).toString();
  const opcionCancelar =
    usuarios.length === 1 ? "3" : (usuarios.length + 2).toString();

  const opcionUsuario = parseInt(message);
  const esOpcionUsuario =
    opcionUsuario >= 1 && opcionUsuario <= usuarios.length;

  if (esOpcionUsuario) {
    await sock.sendMessage(userId, { text: "🔄 Procesando..." });

    if (comprobante.moneda !== "ARS") {
      dolarValue = await DolarService.dameValorDelDolar(comprobante.moneda);
      comprobante.monto = parseInt(comprobante.monto / dolarValue);
      comprobante.tipoDeCambio = dolarValue;
    } else {
      comprobante.monto = parseFloat(comprobante.monto);
      comprobante.tipoDeCambio = "-";
    }

    comprobante.moneda = CURRENCY_DISPLAY[comprobante.moneda];
    comprobante.usuario = usuarios[opcionUsuario - 1];

    const duplicado = await esDuplicado(comprobante, GOOGLE_SHEET_ID);
    console.log("esDuplicado", duplicado);

    if (duplicado.status === "NO DUPLICADO") {
      await addComprobanteToSheet(comprobante, GOOGLE_SHEET_ID);
      FlowManager.resetFlow(userId);
      await sock.sendMessage(userId, {
        text: `✅ *Comprobante enviado correctamente. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing*`,
      });
    } else if (duplicado.status === "DUPLICADO") {
      await sock.sendMessage(userId, {
        text: `❌ *Error: Este comprobante ya existe en el sistema.*`,
      });
      FlowManager.resetFlow(userId);
    } else if (duplicado.status === "POSIBLE DUPLICADO") {
      const comprobanteDuplicado = duplicado.comprobante;
      const mensaje = `⚠️ *Posible duplicado detectado*\n\nSe encontró un comprobante similar con los siguientes datos:\n\n📌 *Detalles del comprobante existente:*\n🔹 *Número de comprobante:* ${comprobanteDuplicado.numero_comprobante}\n🔹 *Fecha:* ${comprobanteDuplicado.fecha}\n🔹 *Cliente:* ${comprobanteDuplicado.cliente}\n🔹 *Cuenta de destino:* ${comprobanteDuplicado.destino}\n🔹 *Monto:* ${comprobanteDuplicado.montoEnviado}\n\n¿Deseas agregar el nuevo comprobante de todas formas?\n\n*1.* ✅ *Sí, agregar de todas formas*\n*2.* ❌ *No, cancelar*`;

      await sock.sendMessage(userId, { text: mensaje });
      FlowManager.setFlow(
        userId,
        "ENVIOCOMPROBANTE",
        "ConfirmacionDuplicadoStep",
        comprobante
      );
    }
  } else if (message === opcionCorregir) {
    await sock.sendMessage(userId, {
      text: "✏️ Por favor, revisa los datos y dinos donde esta el error.\n\nEjemplo: El monto es incorrecto, debería ser $10.000 en lugar de $9.500.",
    });
    FlowManager.setFlow(
      userId,
      "ENVIOCOMPROBANTE",
      "ModificarDatosStep",
      comprobante
    );
  } else if (message === opcionCancelar) {
    await sock.sendMessage(userId, {
      text: "❌ Has cancelado el proceso de confirmación.",
    });
    FlowManager.resetFlow(userId);
  } else {
    await sock.sendMessage(userId, {
      text: "Disculpa, no lo he entendido, elige una de las opciones disponibles",
    });
  }
};
