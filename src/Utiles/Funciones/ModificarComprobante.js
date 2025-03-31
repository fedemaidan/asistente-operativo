const { getByChatGpt4o } = require("../../Utiles/Chatgpt/Base");
const FlowManager = require("../../FlowControl/FlowManager");
const ChatModificarConfirmacion = async (message, userId) => {
  const comprobante = FlowManager.userFlows[userId]?.flowData;
  const prompt = `
    Como bot de gestión de pedidos de retiro de materiales, debo actualizar el pedido según los cambios solicitados por el usuario, sin sobreescribir completamente el pedido anterior. Para ello, debo interpretar la solicitud y aplicar una de las siguientes acciones:

Aprobados: Todo lo que no fue rechazado debe ser aprobado. Es decir, si tengo X de un producto, y el cliente dice que falta Y del mismo producto. Tengo aprobado X-Y

Rechazados: Si una parte del pedido no puede ser aprobada, la cantidad rechazada debe reflejarse en la lista de productos rechazados.

Estructura esperada del JSON de respuesta:

\\\`
  ${JSON.stringify(comprobante, null, 2)},
\\\`
Mensaje del cliente: "${message}"`;

  const respuestaLimpia = await getByChatGpt4o(prompt);
  let respuesta = JSON.parse(respuestaLimpia);
  if (respuesta.hasOwnProperty("json_data")) {
    return respuesta.json_data;
  } else {
    return respuesta;
  }
};

module.exports = ChatModificarConfirmacion;
