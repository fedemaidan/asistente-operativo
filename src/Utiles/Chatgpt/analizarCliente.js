const { getByChatGpt4o } = require("./Base");
const { getClientesFromSheet } = require("../GoogleServices/Sheets/cliente");

module.exports = async function analizarCliente(message) {
  const clientes = await getClientesFromSheet();

  const clientesStr = JSON.stringify(clientes);
  const prompt = `
Analiza el siguiente mensaje y detecta qué cliente se menciona y qué moneda se está utilizando.

Mensaje del usuario: "${message}"

Lista de clientes con cuentas corrientes: ${clientesStr}
Si tiene cuenta corriente (CC), buscalo en la lista.
Si no tiene CC, poné el nombre de cliente que sugiero en el mensaje del usuario sin buscarlo en las CC. 

Reglas:
1. Identifica la moneda mencionada (ARS, USD Blue, USD Oficial, USD MEP).
2. Si no se menciona una moneda específicamente, asume que es ARS (Pesos Argentinos).

Responde ÚNICAMENTE con un JSON válido con este formato exacto:
{
  "nombre": "Si es CC pone el NOMBRE DE LA CUENTA CORRIENTE DETECTADO, ESCRITO TAL CUAL COMO ESTA EN EL LISTADO DE CUENTA CUENTA CORRIENTE y escribi al final entre parentesis (CC), sino poné el nombre del cliente que entendes",
  "moneda": ('ARS', 'USD_OFICIAL_VENTA', 'USD_BLUE_VENTA', 'USD_MEP_VENTA'),
}
`;

  try {
    const response = await getByChatGpt4o(prompt);
    const responseData = JSON.parse(response);

    return responseData;
  } catch (error) {
    console.error("Error al analizar cliente:", error);
    return {
      nombre: "",
      moneda: "ARS",
    };
  }
};
