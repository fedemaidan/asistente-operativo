const FlowMapperCelulandia = require("../../FlowControl/FlowMapper");
const FlowMapperFinanciera = require("../../../gestion-financiera-bot-main/src/services/flowMapper");
const ComprobanteFlow = require("../../Flows/Comprobante/ComprobanteFlow");

const perfilCelulandia = {
  prompts: {
    transcribeImage: `
Sos un experto transcribiendo imagenes. Vas a recibir una imagen de una factura o un comprobante de pago.

Devolve solo un json con el texto transcribido. En el caso de que falten algunos atributos, devolve un - en el campo correspondiente.
No incluyas explicaciones adicionales ni texto extra. Solo el JSON.

Para obtener el destino debes usar el atributo nombre unicamente de una de las siguientes 2 opciones o no encontrado:
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

Aclaracion: 
  1. Los números deben interpretarse según el formato argentino (miles con punto, decimales con coma). Si no contienen decimales, trátalos como enteros.
  2. Los números de dinero o impuestos deben ser float para que los pueda interpretar mi app en node.
  3. La fecha y hora aveces puede estar escrita de forma natural, por ejemplo: "17 de junio de 2025". En ese caso, devolve la fecha en formato dd/mm/yyyy.

    {
        accion: "Confirmar datos",
        data:
        {
            numero_comprobante: "numero de comprobante de la transferencia",
            monto: "monto de la transferencia. Pasamelo en formato float. Ejemplo: 1000.50",
            destino: "cuenta de destino. Puede ser una de las siguientes opciones: ASOCIACION CONSULTURA MUTUAL, ENSHOP SRL o NO ENCONTRADO",            
            fecha: "Es la fecha del comprobante o de transferencia. Formato dd/mm/yyyy. Si no la encuentras, devolve -",  
            hora: "Es la hora del comprobante o de transferencia. Formato hh:mm 24hs. Si no la encuentras, devolve -",
        }
`,
  },
  googleSheetId: "1WMf3LxI5FPd_eQBvQbDJO99uosVjZBxL9RdQSBvTU-Y",
  googleSheetClientsId: "1WMf3LxI5FPd_eQBvQbDJO99uosVjZBxL9RdQSBvTU-Y",
  FlowMapper: FlowMapperCelulandia,
  ComprobanteFlow: ComprobanteFlow,
  name: "celulandia",
};

const perfilCelulandiaDev = {
  ...perfilCelulandia,
  googleSheetId: "1P0ElEtgQps5wA2ujBOWjYMgXT7EblRViM3x471FzGmU",
  googleSheetClientsId: "1P0ElEtgQps5wA2ujBOWjYMgXT7EblRViM3x471FzGmU",
};

const perfilFinanciera = {
  FlowMapper: FlowMapperFinanciera,
  name: "financiera",
  googleSheetId: "1EJkvviTTRyxZNyVRyaqenKnGYNSUTSbHu0pwSxVtY7Q",
};

const perfilFinancieraDev = {
  ...perfilFinanciera,
  googleSheetId: "1EJkvviTTRyxZNyVRyaqenKnGYNSUTSbHu0pwSxVtY7Q",
};

module.exports = {
  perfilCelulandia,
  perfilCelulandiaDev,
  perfilFinanciera,
  perfilFinancieraDev,
};
