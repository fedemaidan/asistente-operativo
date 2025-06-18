const { getByChatGpt4o } = require("../../Utiles/Chatgpt/Base");
const FlowManager = require("../../FlowControl/FlowManager");
const { getClientesFromSheet } = require("../GoogleServices/Sheets/cliente");
const botSingleton = require("../botSingleton");

const ChatModificarConfirmacion = async (message, userId) => {
  const comprobante = FlowManager.userFlows[userId]?.flowData;
  const GOOGLE_SHEET_ID = botSingleton.getSheetIdByUserId(userId);
  const clientes = await getClientesFromSheet(GOOGLE_SHEET_ID);
  const clientesStr = JSON.stringify(clientes.map((cliente) => cliente.nombre));

  const prompt = `
# INSTRUCCIONES PARA ACTUALIZAR COMPROBANTE

## CONTEXTO
Eres un sistema de procesamiento de comprobantes bancarios. Debes modificar los datos de un comprobante existente basado en las correcciones proporcionadas por el usuario.

Lista de clientes con cuentas corrientes: ${clientesStr}
Si tiene cuenta corriente (CC), buscalo en la lista.
Si no tiene CC, poné el nombre de cliente que sugiero en el mensaje del usuario sin buscarlo en las CC. 
Si cambia el cliente, debes volver a analizar el atributo cuentaCorriente y ver si es true o false dependiendo si el cliente tiene cuenta corriente o no.
Si el usuario quiere cambiar la moneda, solo pueden ser las siguientes opciones: ('ARS', 'USD_OFICIAL_VENTA', 'USD_BLUE_VENTA').
Si el usuario menciona que la moneda es pesos, se refiere a ARS.
Si el usuario menciona que la moneda es dolares, se refiere a USD_BLUE_VENTA.

Si el usuario quiere cambiar el atributo destino, debes elegir uno de los 4 destinos posibles:

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
  },
  {
    "nombre": "EZE",
  }, {
    "nombre": "NICO"
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
4. Si el usuario menciona un nuevo cliente o moneda, actualiza los campos correspondientes. No puedes agregar ningun campo.
5. El montoEnviado es SIEMPRE en ARS. Si el usuario pide cambiar el monto, se cambia el montoEnviado.
6. Si el usuario pide cambiar la moneda solo pueden ser las siguientes opciones: ('ARS', 'USD_OFICIAL_VENTA', 'USD_BLUE_VENTA', 'USD_MEP_VENTA').

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
