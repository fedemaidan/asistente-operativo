const FlowManager = require("../../../FlowControl/FlowManager");
const GuardarEstadoChofer = require("../../../Utiles/Funciones/Chofer/GuardarEstadoChofer");
const BuscarHoja = require("../../../Utiles/Funciones/Logistica/IniciarRuta/BuscarHoja");

module.exports = async function EnvioComprobante(userId, data, sock) {
  try {
    //const hojaRuta = FlowManager.userFlows[userId]?.flowData;

    // Construir mensaje de respuesta
    const mensaje = `📌 *Confirmación de Datos* 📌

    Para procesar tu solicitud, necesitamos que confirmes los siguientes datos de la transferencia:
    
    🔹 *Número de comprobante:* ${data.numero_comprobante}
    🔹 *Monto:* ${data.monto}
    🔹 *Fecha:* ${data.fecha}
    🔹 *Hora:* ${data.hora}
    🔹 *Nombre:* ${data.nombre}
    🔹 *Apellido:* ${data.apellido}
    🔹 *CUIT:* ${data.cuit}
    🔹 *DNI:* ${data.dni}
    
    ⚠️ *Por favor, revisa que los datos sean correctos.* Si hay algún error, envíanos la información correcta.
    `;

    // Enviar mensaje de respuesta
    await sock.sendMessage(userId, { text: mensaje });
    console.log("✅ Mensaje enviado correctamente.");

    await sock.sendMessage(userId, {
      text: "✅ Si los datos son correctos, responde con *1*. Si hay algún error, responde con *2* y si quieres cancelar *3*.",
    });

    FlowManager.setFlow(
      userId,
      "ENVIOCOMPROBANTE",
      "ValidacionComprobante",
      data
    );
  } catch (error) {
    console.error("❌ Error en PrimeraEleccionEntrega:", error);
  }
};
