const { getByChatGpt4o } = require("../../Utiles/Chatgpt/Base");
const FlowManager = require("../../FlowControl/FlowManager");

const ChatModificarConfirmacion = async (message, userId) => {
  const comprobante = FlowManager.userFlows[userId]?.flowData;

  const prompt = `
# INSTRUCCIONES PARA ACTUALIZAR COMPROBANTE

## CONTEXTO
Eres un sistema de procesamiento de comprobantes bancarios. Debes modificar los datos de un comprobante existente basado en las correcciones proporcionadas por el usuario.
Si el usuario quiere cambiar el atributo destino, debes elegir uno de los 2 destinos posibles:

[
  {
    "nombre": "ASOCIACION CONSULTURA MUTUAL",
    "cuit": "30-71108832-2",
    "cvu": "0000252500000001000054"
  },
  {
    "nombre": "ENSHOP SRL",
    "cuit": "30-71519047-4",
    "cbu": "0720044120000000414890"
  }
]

## COMPROBANTE ACTUAL (JSON)
\`\`\`json
${JSON.stringify(comprobante, null, 2)}
\`\`\`

## CORRECCIONES DEL USUARIO
"${message}"

## TAREA
1. Analiza las correcciones solicitadas en el mensaje del usuario
2. Modifica SOLO los campos mencionados en las correcciones
3. Mantén intactos todos los demás campos del comprobante original
4. Si el usuario menciona un nuevo cliente o moneda, actualiza los campos correspondientes. No puedes agregar ningun campo
5. El montoEnviado es SIEMPRE en ARS. Si el usuario pide cambiar el monto, se cambia el montoEnviado.

## FORMATO DE RESPUESTA
Devuelve SOLO un objeto JSON con el comprobante actualizado, manteniendo exactamente la misma estructura que el comprobante original, pero con los campos corregidos según la solicitud del usuario.

NO incluyas explicaciones adicionales, comentarios ni texto alrededor del JSON.
`;

  const respuestaLimpia = await getByChatGpt4o(prompt);

  try {
    return JSON.parse(respuestaLimpia);
  } catch (error) {
    console.log(
      "Error al parsear la respuesta inicial, buscando JSON válido..."
    );
    const jsonMatch = respuestaLimpia.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    console.error("No se pudo extraer un JSON válido de la respuesta:", error);
    return null;
  }
};

module.exports = ChatModificarConfirmacion;
