const FlowManager = require('../services/flowManager');
const { saveImageToStorage } = require('../services/firebase/storageHandler');
const { analizarComprobantes } = require('../services/chatgpt/analizarComprobantes');
const { formatCurrency } = require('../utils/formatCurrency');
const { getFechaFirestore } = require('../utils/fechas');
const ProveedoresService = require('../services/ProveedoresService');
const { analizarModificacionComprobante } = require('../services/chatgpt/analizarModificacionComprobante');
const { analizarModificacionOperacion} = require('../services/chatgpt/analizarModificacionOperacion');
const { addComprobanteToSheet } = require('../services/GoogleSheetsService');
const { generarMensajeCheque, generarResumenOperacion, generarMensajeTransferencia, generarMensajeSeleccionProveedor, generarMensajeConfirmacionOperacion, generarMensajeModificacion } = require('../utils/generarMensajeOperaciones');
const { getDescuentoGeneral } = require('../utils/getDescuentoGeneral');

// Función para determinar si un paso es necesario
const isStepRequired = (step, chequeType) => {
    const stepsToSkip = {
        'CHEQUE': [], // No se omite ningún paso para CHEQUE
        'TRANSFERENCIA': [2], // Omitir paso 2 para transferencias
        'OTRO': [2], // Omitir paso 2 para otros tipos
    };

    return !stepsToSkip[chequeType]?.includes(step);
};

const STEPS = {
        START: 'START',
        CLIENTE_EMISOR: 'CLIENTE_EMISOR',
        CLIENTE_RECEPTOR: 'CLIENTE_RECEPTOR',
        TIPO_CHEQUE: 'TIPO_CHEQUE',
        CONFIRMACION: 'CONFIRMACION',
        QUE_MODIFICO: 'QUE_MODIFICO',
        MODIFICO_OPERACION: 'MODIFICO_OPERACION',
        QUERES_MODIFICAR_CHEQUE: 'QUERES_MODIFICAR_CHEQUE',
        SELECCIONO_CHEQUE: 'SELECCIONO_CHEQUE',
        MODIFICA_CHEQUE: 'MODIFICA_CHEQUE',
}

const crearOperacionFlow = {
    async start(userId, message, sock, messageType) {
        try {
            await sock.sendMessage(userId, { text: '📝 Creando operación...\nPor favor, espera mientras procesamos tu imagen.' });

            // Descargar y guardar la imagen en Firebase Storage
            const phoneNumber = userId.split('@')[0];
            const imageUrl = await saveImageToStorage(message, phoneNumber);
            
            if (!imageUrl) {
                FlowManager.resetFlow(userId);
                await sock.sendMessage(userId, { text: '⚠️ No pude procesar la imagen. Por favor, intenta nuevamente.' });
                return;
            }

            // Analizar el cheque para obtener datos iniciales
            const { respuesta: comprobantes, prompt } = await analizarComprobantes(imageUrl);

            if (!comprobantes) {
                FlowManager.resetFlow(userId);
                await sock.sendMessage(userId, { text: '⚠️ No pude extraer información. Por favor, intenta nuevamente.' });
                return;
            }
            
            switch  (comprobantes.tipo) {
                case "CHEQUES": 
                    let montoTotal = 0;
                    for (let index = 0; index < comprobantes.cheques.length; index++) {
                        const cheque = comprobantes.cheques[index];
                        comprobantes.cheques[index].descuentoGeneral = getDescuentoGeneral(cheque, "CHEQUE")//1.8 * cheque.monto / 100;
                        comprobantes.cheques[index].tipo = "CHEQUE";
                        comprobantes.cheques[index].fecha = getFechaFirestore(null);
                        montoTotal += cheque.monto;

                        await sock.sendMessage(userId, {
                            text: `✅ Cheque ${index+1}:\n\n` +
                                `- *Monto*: ${formatCurrency(cheque.monto) || 'No detectado'}\n` +
                                `- *Número de comprobante*: ${cheque.numero_comprobante || 'No detectado'}\n` +
                                `- *Banco emisor*: ${cheque.banco_emisor || 'No detectado'}\n` + 
                                `- *CUIT*: ${cheque.cuit || 'No detectado'}\n` + 
                                `- *Fecha de pago*: ${cheque.fecha_pago || 'No detectado'}` 
                        });
                    }

                    await sock.sendMessage(userId, {text: generarResumenOperacion(montoTotal)});

                    FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.QUERES_MODIFICAR_CHEQUE, { comprobantes: comprobantes.cheques, tipoOperacion: "CHEQUE" });
                    break;
                case "TRANSFERENCIA": 
                    const transferencia = comprobantes;
                    transferencia.descuentoGeneral = getDescuentoGeneral(transferencia, "TRANSFERENCIA")
                    transferencia.fecha = getFechaFirestore(null);
                    await sock.sendMessage(userId, {
                        text: generarMensajeTransferencia(transferencia, { clienteEmisor: null, clienteReceptor: null }),
                    });
                    
                    FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.QUERES_MODIFICAR_CHEQUE, { comprobantes: [transferencia], tipoOperacion: "TRANSFERENCIA" });
                    await sock.sendMessage(userId, {
                        text: 'Confirmar si los datos están correctos:\n\n' +
                        '1️⃣ Si, continuemos\n2️⃣ No, modificar datos de la transferencia',
                    });
                    break; 
            }
            
        } catch (error) {
            console.error('Error en crearOperacionFlow:', error.message);
            FlowManager.resetFlow(userId);
            await sock.sendMessage(userId, { text: '⚠️ Ocurrió un error procesando la operación. Intenta nuevamente.' });
        }
    },

    async handle(userId, message, step, sock, messageType) {
        //if (messageType !== 'text' || messageType !== 'text_extended') {
        const esTexto = messageType !== 'text' ? messageType !== 'text_extended' : false;
        if (esTexto) {
            await sock.sendMessage(userId, { text: '⚠️ Por favor, responde con texto para continuar.' });
            return;
        }

        const flowData = FlowManager.getFlow(userId)?.flowData || {};

        switch (step) {
            case STEPS.CLIENTE_EMISOR: // Solicitar el cliente emisor
                flowData.clienteEmisor = message;
                FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.CLIENTE_RECEPTOR, flowData);
                const proveedores = await ProveedoresService.obtenerProveedores();
                await sock.sendMessage(userId, { text: generarMensajeSeleccionProveedor(proveedores) });
                break;

            case STEPS.CLIENTE_RECEPTOR: // Solicitar el cliente receptor
                const proveedoresList = await ProveedoresService.obtenerProveedores();
                const proveedorSeleccionado = proveedoresList[parseInt(message) - 1]; // Verificamos si el mensaje es un número válido

                if (proveedorSeleccionado) {
                    flowData.clienteReceptor = proveedorSeleccionado.nombre;
                } else {
                    ProveedoresService.agregarProveedor(message);
                    flowData.clienteReceptor = message;
                }

                if (isStepRequired(2, flowData.tipoOperacion)) {
                    FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.TIPO_CHEQUE, flowData);
                    await sock.sendMessage(userId, {
                        text: '3️⃣ ¿Qué tipo de cheque es? Responde con el número correspondiente:\n\n' +
                            '1️⃣ Gestión 1.2\n' +
                            '2️⃣ Gestión 1.7\n' +
                            '3️⃣ Diferido\n' +
                            '4️⃣ Pecho',
                    });
                } else {
                    const transferencia = flowData.comprobantes[0]
                    transferencia.tipoCheque = 'Transferencia';
                    transferencia.descuento = 1 * transferencia.monto / 100;
                    transferencia.total = transferencia.monto - transferencia.descuentoGeneral - transferencia.descuento;
                    FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.CONFIRMACION, { comprobantes: [transferencia]});

                    await sock.sendMessage(userId, {
                        text: generarMensajeConfirmacionOperacion(flowData, transferencia),
                    });
                }
                break;

            case STEPS.TIPO_CHEQUE: // Solicitar el tipo de cheque
                const opcionesCheque = {
                    '1': 'Gestión 1.2',
                    '2': 'Gestión 1.7',
                    '3': 'Diferido',
                    '4': 'Pecho',
                };

                const descuentos = {
                    '1': 1.2,
                    '2': 1.7,
                    '3': 1,
                    '4': 1.7,
                };

                const tipoCheque = opcionesCheque[message];
                const descuento = descuentos[message];

                let montoTotal = 0
                let montoReciboTotal = 0
                await sock.sendMessage(userId, {
                    text: `✅ Perfecto, estos son los datos recopilados:`})

                if (tipoCheque) {
                    for (let i = 0; i < flowData.comprobantes.length; i++) {
                        const cheque = flowData.comprobantes[i];
                        cheque.tipoCheque = tipoCheque;
                        cheque.descuento = descuento * cheque.monto / 100;
                        cheque.total = cheque.monto - cheque.descuentoGeneral - cheque.descuento;
                        flowData.comprobantes[i] = cheque;
                        montoTotal += cheque.monto;
                        montoReciboTotal += cheque.total;

                        await sock.sendMessage(userId, {text: generarMensajeCheque(cheque, i, flowData, descuento)});
                    }
                    
                    await sock.sendMessage(userId, {text:  `💰 *Total de la operación:* ${formatCurrency(montoTotal)} \n\n 💰 *Total a recibir:* ${formatCurrency(montoReciboTotal)}`});
                    
                } else {
                    await sock.sendMessage(userId, {
                        text: '⚠️ Respuesta no válida. Por favor, responde con el número correspondiente:\n1️⃣ Gestión\n2️⃣ Diferido\n3️⃣ Pecho',
                    });
                }

                await sock.sendMessage(userId, {
                    text: `¿Deseas confirmar esta operación?\n\n` +
                            `1️⃣ Confirmar\n` +
                            `2️⃣ Cancelar\n`})

                FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.CONFIRMACION, flowData);
                break;

            case STEPS.CONFIRMACION: 
                if (message === '1') {
                    FlowManager.resetFlow(userId);
                    for (let i = 0; i < flowData.comprobantes.length; i++) {
                        const comprobante = flowData.comprobantes[i];
                        addComprobanteToSheet(comprobante, flowData.clienteEmisor, flowData.clienteReceptor)   
                    }
                    await sock.sendMessage(userId, { text: '🎉 ¡Operación registrada con éxito! Gracias por confiar en nuestro servicio.' });
                } else if (message === '2') {
                    FlowManager.resetFlow(userId);
                    await sock.sendMessage(userId, { text: '❌ Operación cancelada. Si necesitas algo más, ¡escríbeme!' });
                } else {
                    await sock.sendMessage(userId, { text: '⚠️ Respuesta no válida. Elige:\n1️⃣ Confirmar\n2️⃣ Cancelar\n3️⃣ Modificar' });
                }
                break;
            
            case STEPS.QUERES_MODIFICAR_CHEQUE: // 6. Preguntar si quiere modificar un cheque
                if (message === '1') {
                    // Si el usuario no quiere modificar, pasamos al siguiente paso
                    FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.CLIENTE_EMISOR, flowData);
                    await sock.sendMessage(userId, { text: '2️⃣ ¿Quién es el cliente que envía? (Escribe el nombre).' });
                } else if (message === '2') {
                    if (flowData.comprobantes.length === 1) { 
                        // Si solo hay un cheque, modificarlo directamente
                        flowData.comprobanteSeleccionado = 0;
                        flowData.comprobantes[0].descuentoGeneral = getDescuentoGeneral(flowData.comprobantes[0], flowData.tipoOperacion);
                        FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.MODIFICA_CHEQUE, flowData);
                        
                        await sock.sendMessage(userId, {
                            text: `✏️ Escribe qué dato deseas modificar (Ejemplo: "El monto es incorrecto, debe ser 50,000").`,
                        });
                    } else {
                        // Si hay varios cheques, mostrar la lista para elegir cuál modificar
                        let mensaje = '✏️ ¿Qué cheque deseas modificar? Envía el número correspondiente:\n\n';
                        flowData.comprobantes.forEach((cheque, index) => {
                            mensaje += `${index + 1}️⃣ ${formatCurrency(cheque.monto)} - ${cheque.banco_emisor}\n`;
                        });
                
                        FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.SELECCIONO_CHEQUE, flowData);
                        await sock.sendMessage(userId, { text: mensaje });
                    }
                } else {
                    await sock.sendMessage(userId, { text: '⚠️ Respuesta no válida. Escribe 1️⃣ para continuar o 2️⃣ para modificar un cheque.' });
                }
                break;
            case STEPS.SELECCIONO_CHEQUE: // 7. Seleccionar el cheque a modificar
                const indexS = parseInt(message) - 1;
            
                if (!isNaN(indexS) && flowData.comprobantes[indexS]) {
                    flowData.comprobanteSeleccionado = indexS;
                    FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.MODIFICA_CHEQUE, flowData);
                    await sock.sendMessage(userId, {
                        text: `✏️ Escribe qué dato deseas modificar (Ejemplo: "El monto es incorrecto, debe ser 50,000").`,
                    });
                } else {
                    await sock.sendMessage(userId, { text: '⚠️ Selección no válida. Envía el número del cheque que deseas modificar.' });
                }
                break;
            case STEPS.MODIFICA_CHEQUE: // 8. Aplicar modificación al cheque seleccionado
                const chequeModificar = flowData.comprobantes[flowData.comprobanteSeleccionado];
            
                if (chequeModificar) {
                    const respuesta = await analizarModificacionComprobante(chequeModificar, message);
                    flowData.comprobantes[flowData.comprobanteSeleccionado] = { ...chequeModificar, ...respuesta.respuesta };
                    flowData.comprobantes[flowData.comprobanteSeleccionado].descuentoGeneral = getDescuentoGeneral(flowData.comprobantes[flowData.comprobanteSeleccionado], flowData.tipoOperacion);
                    FlowManager.setFlow(userId, 'CREAR_OPERACION', STEPS.QUERES_MODIFICAR_CHEQUE, flowData);
            
                    await sock.sendMessage(userId, {
                        text: generarMensajeModificacion(flowData, flowData.comprobantes[flowData.comprobanteSeleccionado]),
                    });
                } else {
                    await sock.sendMessage(userId, { text: '⚠️ Ocurrió un error. Intenta seleccionar el cheque nuevamente.' });
                }
                break;
            
            default:
                FlowManager.resetFlow(userId);
                await sock.sendMessage(userId, { text: '⚠️ Algo salió mal. Intenta nuevamente desde el inicio.' });
            
        }
    },
};

module.exports = crearOperacionFlow;
