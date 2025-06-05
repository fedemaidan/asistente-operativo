const FlowManager = require("../../../FlowControl/FlowManager");
const analizarCliente = require("../../../Utiles/Chatgpt/analizarCliente");
const {
  formatCurrency,
} = require("../../../Utiles/Funciones/Moneda/formatCurrency");
const CURRENCY_DISPLAY = require("../../../Utiles/Funciones/Moneda/CurrencyDisplay");
const botSingleton = require("../../../Utiles/botSingleton");

module.exports = async function ElegirClienteStep(userId, message) {
  const sock = botSingleton.getSock();
  await sock.sendMessage(userId, {
    text: "⏳Analizando mensaje...⏳",
  });
  const cliente = await analizarCliente(message);
  const comprobante = FlowManager.userFlows[userId].flowData.data;

  const mensaje = `📌 *Confirmación de Datos* 📌\nPara procesar tu solicitud, necesitamos que confirmes los siguientes datos de la transferencia:\n🔹 *Número de comprobante:* ${
    comprobante.numero_comprobante
  }\n🔹 *Fecha:* ${comprobante.fecha}\n🔹 *Hora:* ${
    comprobante.hora
  }\n🔹 *Cliente*: ${cliente.nombre}\n🔹 *Cuenta Corriente:* ${
    cliente.cuentaCorriente ? "Sí" : "No"
  }\n🔹 *Cuenta de destino:* ${
    comprobante.destino
  }\n🔹 *Monto:* ${formatCurrency(comprobante.monto, "ARS")}\n🔹 *Moneda:* ${
    CURRENCY_DISPLAY[cliente.moneda]
  }`;

  await sock.sendMessage(userId, {
    text: mensaje,
  });

  await sock.sendMessage(userId, {
    text: "¿Los datos son correctos? Indiqué con el número su respuesta.\n\n*1.* ✅ *Si*\n*2.* 📝 *No, quiero corregirlo.*\n*3.* ❌ *Cancelar, voy a pedirlo nuevamente.*",
  });

  comprobante.estado = "PENDIENTE";
  comprobante.montoEnviado = parseFloat(comprobante.monto);
  comprobante.cliente = cliente.nombre;
  comprobante.moneda = cliente.moneda;
  comprobante.cuentaCorriente = cliente.cuentaCorriente;

  FlowManager.setFlow(
    userId,
    "ENVIOCOMPROBANTE",
    "ValidacionDatosStep",
    comprobante
  );
};
