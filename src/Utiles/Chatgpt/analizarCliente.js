const { getByChatGpt4o } = require("./Base");
const { getClientesFromSheet } = require("../GoogleServices/Sheets/cliente");

module.exports = async function analizarCliente(message) {
  const clientes = await getClientesFromSheet();

  const clientesStr = JSON.stringify(clientes);
  const prompt = `
Analiza el siguiente mensaje y detecta qué cliente se menciona y qué moneda se está utilizando.

Mensaje del usuario: "${message}"

Lista de clientes posibles: ${clientesStr}

Monedas posibles:
- ARS (Pesos Argentinos)
- USD Blue (Dólar Blue)
- USD Oficial (Dólar Oficial)
- USD MEP (Dólar MEP)

Reglas:
1. Identifica el cliente mencionado de la lista proporcionada. Puede estar mencionado de forma exacta o de forma aproximada.
2. Identifica la moneda mencionada (ARS, USD Blue, USD Oficial, USD MEP).
3. Si no se menciona una moneda específicamente, asume que es ARS (Pesos Argentinos).
4. Si se menciona más de un cliente, selecciona el que parezca más relevante en el contexto.

Responde ÚNICAMENTE con un JSON válido con este formato exacto:
{
  "nombre": "NOMBRE DEL CLIENTE DETECTADO",
  "moneda": "MONEDA DETECTADA",
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
