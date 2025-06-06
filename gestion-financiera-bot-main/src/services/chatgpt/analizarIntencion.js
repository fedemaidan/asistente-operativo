const { getByChatgpt35TurboByText } = require("./base");

const opciones = [
    {
        name: "Crear una operación a partir de un cheque",
        accion: "CREAR_OPERACION",
        json_data: {
            "accion": "CREAR_OPERACION",
            "monto": "Es el monto del cheque",
            "numero_operacion": "Es el número del cheque",
            "banco_emisor": "Es el banco emisor del cheque",
            "fecha": "Es la fecha del cheque",
            "cliente_envia": "Es el cliente que envía el cheque",
            "cliente_recibe": "Es el cliente que recibe el cheque",
            "tipo": "Es el tipo de cheque",
            "interes_extra": "Es el interés extra del cheque"
        }
    },
    {
        name: "Confirmar el pago de una operación pendiente",
        accion: "CONFIRMAR_PAGO",
        json_data: {
            "accion": "CONFIRMAR_PAGO",
            "id_operacion": "Es el ID de la operación pendiente que quieres confirmar como pagada",
            "cliente_envia": "Es el cliente que realizó el pago",
            "monto_pagado": "Es el monto pagado correspondiente a la operación"
        }
    },
    {
        name: "Confirmar el cobro de una operación pendiente",
        accion: "CONFIRMAR_COBRO",
        json_data: {
            "accion": "CONFIRMAR_COBRO",
            "id_operacion": "Es el ID de la operación pendiente que quieres confirmar como cobrada",
            "cliente_recibe": "Es el cliente que realizó el cobro",
            "monto_cobrado": "Es el monto cobrado correspondiente a la operación"
        }
    },
    {
        name: "Consultar todas las cuentas por pagar",
        accion: "CONSULTAR_CUENTAS_POR_PAGAR",
        json_data: {
            "accion": "CONSULTAR_CUENTAS_POR_PAGAR",
            "cliente": "Es el cliente para el cual quieres consultar las cuentas por pagar (opcional, puede ser todos los clientes)"
        }
    },
    {
        name: "Consultar todas las cuentas por cobrar",
        accion: "CONSULTAR_CUENTAS_POR_COBRAR",
        json_data: {
            "accion": "CONSULTAR_CUENTAS_POR_COBRAR",
            "cliente": "Es el cliente para el cual quieres consultar las cuentas por cobrar (opcional, puede ser todos los clientes)"
        }
    },
    {
        name: "Ver el saldo actual de un cliente",
        accion: "VER_SALDO_CLIENTE",
        json_data: {
            "accion": "VER_SALDO_CLIENTE",
            "cliente": "Es el cliente del cual quieres consultar el saldo actual"
        }
    },
    {
        name: "Agregar un nuevo cliente",
        accion: "AGREGAR_CLIENTE",
        json_data: {
            "accion": "AGREGAR_CLIENTE",
            "nombre": "Es el nombre completo del cliente",
            "documento": "Es el documento de identidad o CUIT del cliente",
            "email": "Es el correo electrónico del cliente (opcional)",
            "telefono": "Es el teléfono de contacto del cliente (opcional)"
        }
    },
    {
        name: "Actualizar datos de un cliente",
        accion: "ACTUALIZAR_CLIENTE",
        json_data: {
            "accion": "ACTUALIZAR_CLIENTE",
            "id_cliente": "Es el ID del cliente que quieres actualizar",
            "nuevos_datos": {
                "nombre": "Nuevo nombre del cliente (opcional)",
                "documento": "Nuevo documento del cliente (opcional)",
                "email": "Nuevo correo electrónico del cliente (opcional)",
                "telefono": "Nuevo teléfono del cliente (opcional)"
            }
        }
    }
];


// Servicio para analizar la intención del mensaje
const analizarIntencion = async (message) => {
    
    const opcionesTxt = JSON.stringify(opciones);
    try {
        const prompt = `
        Soy un bot de una financiera que ayuda a gestionar operaciones y cuentas. Mi trabajo es identificar la intención del usuario y ejecutar la acción adecuada.         
        El usuario dice: "${message}"
        Tienes estas acciones posibles: " + ${opcionesTxt} + ".
        Responde la acción que quieres ejecutar y completa los datos correspondientes del JSON.
        Solo pueder retornar las acciones que yo envío.Ten en cuenta los números en Argentina separan los miles con punto y los decimales con coma, ademas tanto el total como los demas números del comprobante debe considerarse como números entero si no contienen decimales. 
        RESPONDE SOLO CON EL JSON CON LOS DATOS CARGADOS. SOLO USAR ACCIONES LISTADAS. ";
        `;
        const response = await getByChatgpt35TurboByText(prompt);
        const respuesta = JSON.parse(response);
        if (respuesta.hasOwnProperty('json_data'))
        return { respuesta: respuesta.json_data, prompt: prompt};
        else
        return { respuesta: respuesta, prompt: prompt};
    } catch (error) {
        console.error('Error al analizar la intención:', error.message);
        return 'desconocido'; // Intención predeterminada en caso de error
    }
};

module.exports = { analizarIntencion };
