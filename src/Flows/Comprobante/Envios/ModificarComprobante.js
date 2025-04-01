const ModificarComprobanteGpt = require("../../../Utiles/Funciones/ModificarComprobante");
const flowManager = require("../../../FlowControl/FlowManager");

module.exports = async function ModificarComprobante(userId, message, sock) {
  try {
    const respuesta = await ModificarComprobanteGpt(message, userId);

    if (!respuesta) {
      await sock.sendMessage(userId, {
        text: "❌ Error al procesar la modificación. Por favor, intenta nuevamente.",
      });
      return;
    }

    const mensajeActualizado = `📝 
    *Datos actualizados:*\n
  🔹 *Número de comprobante:* ${respuesta.numero_comprobante}
  🔹 *Monto:* ${respuesta.monto}
  🔹 *Fecha:* ${respuesta.fecha}
  🔹 *Hora:* ${respuesta.hora}
  🔹 *Nombre:* ${respuesta.nombre}
  🔹 *Apellido:* ${respuesta.apellido}
  🔹 *CUIT:* ${respuesta.cuit}
  🔹 *DNI:* ${respuesta.dni}\n
  ✅ *¿Los datos son correctos ahora?*
  1️⃣ - Sí, confirmar
  2️⃣ - No, modificar nuevamente
  3️⃣ - Cancelar`;

    await sock.sendMessage(userId, { text: mensajeActualizado });
    flowManager.setFlow(
      userId,
      "ENVIOCOMPROBANTE",
      "ValidacionComprobante",
      respuesta
    );
  } catch {
    console.error("❌ Error en ModificarComprobante:", error);
  }
};
