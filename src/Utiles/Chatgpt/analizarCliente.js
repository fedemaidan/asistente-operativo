const { getByChatGpt4o } = require("./Base");
const { getClientesFromSheet } = require("../GoogleServices/Sheets/cliente");

module.exports = async function analizarCliente(message, GOOGLE_SHEET_ID) {
  const clientes = await getClientesFromSheet(GOOGLE_SHEET_ID);
  const clientesStr = JSON.stringify(clientes);
  const prompt = `
  Analiza el siguiente mensaje y detecta qué cliente se menciona y qué moneda se está utilizando.
  
  Mensaje del usuario: "${message}"
  
  Lista de clientes con sus cuentas corrientes: ${clientesStr}
  Si tiene cuenta corriente (CC), buscalo en la lista.
  Si no tiene CC, poné el nombre de cliente que sugiero en el mensaje del usuario sin buscarlo en las CC. 
  
  Reglas:
  1. Identifica la moneda mencionada (ARS, USD Blue, USD Oficial, USD MEP).
  2. Si no se menciona una moneda específicamente, busca en el atributo ccActivas y si tiene solo una cuenta corriente selecciona esa, si tiene mas de una cuenta corriente asume que es ARS (Pesos Argentinos).
  4. Si el usuario selecciona un cliente del listado de cuentas corrientes con una moneda que no se encuentra en su listado de ccActivas, error = true.
  3. Si no se especifica que tipo de dolar es, asume que es el blue.
  4. Si dice que le moneda es pesos, se refiere a ARS.
  5. Los números deben interpretarse según el formato argentino (miles con punto, decimales con coma). Si no contienen decimales, trátalos como enteros.
  6. Los números de dinero o impuestos deben ser float para que los pueda interpretar mi app en node.
  
  Responde ÚNICAMENTE con un JSON válido con este formato exacto:
  {
    "nombre": "Si es el nombre es de CC pone el NOMBRE DE LA CUENTA CORRIENTE DETECTADO, ESCRITO TAL CUAL COMO ESTA EN EL LISTADO DE CUENTA CUENTA CORRIENTE, sino poné el nombre del cliente que entendes",
    "cuentaCorriente": "dame true o false dependiendo si el cliente tiene cuenta corriente o no",
    "moneda": ('ARS', 'USD_OFICIAL_VENTA', 'USD_BLUE_VENTA'). Es la moneda seleccionada por el cliente,
    "error": (true o false),
    "ccActivas": "array de cuentas corrientes activas del cliente seleccionado, si no tiene CC, poné un array vacio.",
    "descuento": descuento del cliente seleccionado, si no tiene CC, pone 0
    }
    `;

  try {
    const response = await getByChatGpt4o(prompt);
    const responseData = JSON.parse(response);

    if (responseData.nombre) {
      responseData.nombre = responseData.nombre.toUpperCase();
    }

    return responseData;
  } catch (error) {
    console.error("Error al analizar cliente:", error);
    return {
      nombre: "",
      moneda: "ARS",
    };
  }
};
