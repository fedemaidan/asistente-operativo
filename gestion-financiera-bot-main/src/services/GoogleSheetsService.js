const { google } = require('googleapis');
const { formatearFechaFirestore } = require('../utils/fechas');

// Cargar las credenciales desde la variable de entorno
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

// Autenticación con Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials, // Se pasan las credenciales directamente
  scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Permisos de edición en Sheets
});

module.exports = auth;


const sheets = google.sheets({ version: 'v4', auth });

// ID de la hoja de Google Sheets (reemplázalo con el tuyo)
const SHEET_ID = '1EJkvviTTRyxZNyVRyaqenKnGYNSUTSbHu0pwSxVtY7Q';
const SHEET_NAME = 'Registros';
const SHEET_RANGE = `${SHEET_NAME}!A1:H10000`;

/**
 * Verifica si la hoja de registros existe y la crea si no está.
 * @returns {Promise<boolean>}
 */
async function verificarOCrearHoja() {
    try {
        // Obtener todas las hojas del archivo
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SHEET_ID,
        });

        const hojas = response.data.sheets.map(sheet => sheet.properties.title);

        // Si la hoja no existe, la creamos
        if (!hojas.includes(SHEET_NAME)) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SHEET_ID,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: SHEET_NAME,
                                },
                            },
                        },
                    ],
                },
            });

            console.log(`✅ Hoja "${SHEET_NAME}" creada en Google Sheets.`);
        }

        return true;
    } catch (error) {
        console.error('❌ Error al verificar o crear la hoja en Google Sheets:', error);
        return false;
    }
}

/**
 * Agrega un cheque o transferencia a Google Sheets.
 * @param {Object} comprobante - Datos del cheque o transferencia.
 * @returns {Promise<boolean>} - Retorna true si la operación fue exitosa, false en caso de error.
 */
async function addComprobanteToSheet(comprobante, clienteEmisor, clienteReceptor) {
    try {
        // Verificar si la hoja existe antes de agregar datos
        await verificarOCrearHoja();

        const values = [
            formatearFechaFirestore(comprobante.fecha),
            comprobante.fecha_pago,
            comprobante.monto,
            comprobante.tipo,
            comprobante.banco_emisor,
            comprobante.numero_comprobante,
            clienteEmisor,
            clienteReceptor,
            comprobante.tipoCheque,
            comprobante.descuento,
            comprobante.descuentoGeneral,
            comprobante.total,
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: SHEET_RANGE,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [values],
            },
        });

        console.log(`✅ Comprobante agregado a Google Sheets: ${comprobante.id}`);
        return true;
    } catch (error) {
        console.error('❌ Error al agregar comprobante a Google Sheets:', error);
        return false;
    }
}

module.exports = {
    addComprobanteToSheet,
};
