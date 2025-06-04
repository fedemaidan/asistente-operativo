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
3. Si no se especifica que tipo de dolar es, asume que es el blue.
4. Si dice que le moneda es pesos, se refiere a ARS.

Responde ÚNICAMENTE con un JSON válido con este formato exacto:
{
  "nombre": "Si es el nombre es de CC pone el NOMBRE DE LA CUENTA CORRIENTE DETECTADO, ESCRITO TAL CUAL COMO ESTA EN EL LISTADO DE CUENTA CUENTA CORRIENTE, sino poné el nombre del cliente que entendes",
  "cuentaCorriente": "dame true o false dependiendo si el cliente tiene cuenta corriente o no",
  "moneda": ('ARS', 'USD_OFICIAL_VENTA', 'USD_BLUE_VENTA'),
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
