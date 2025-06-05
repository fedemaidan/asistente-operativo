const FlowManager = require("../../../FlowControl/FlowManager");
const botSingleton = require("../../../Utiles/botSingleton");

module.exports = async function CargarStockStep(userId, data) {
  const sock = botSingleton.getSock();
  const stockArray = Array.isArray(data) ? data : Object.values(data);

  if (!stockArray || stockArray.length === 0) {
    await sock.sendMessage(userId, {
      text: "❌ *Error al procesar el archivo*\n\nEl archivo parece estar vacío o no tiene el formato esperado.",
    });
    return;
  }

  const camposRequeridos = ["Codigo", "Descripcion", "Cantidad", "Precio"];
  const camposFaltantes = camposRequeridos.filter(
    (key) => !(key in stockArray[0])
  );

  if (camposFaltantes.length > 0) {
    await sock.sendMessage(userId, {
      text: `❌ *Error en el formato del archivo*\n\nEl archivo no contiene todos los campos necesarios para un reporte de stock. Verifica si has enviado el archivo correcto`,
    });
    return;
  }

  FlowManager.setFlow(userId, "STOCK", "CargarVentasStep", { stockArray });

  await sock.sendMessage(userId, {
    text:
      `✅ *Stock procesado correctamente*\n\n` +
      `Ahora envíe el archivo Excel de *Ventas* para continuar.`,
  });

  console.log("DATA", stockArray.slice(0, 5));
};
