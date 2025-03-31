// Importa la librería Baileys para conexión con WhatsApp
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
// Importa Boom para el manejo de errores (opcional)
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
// Importa Express para exponer el QR vía web
const express = require('express');
const app = express();

// Variable para almacenar el último QR generado (si se requiere)
let latestQR = null;

// Ruta para mostrar el QR en un navegador
app.get('/qr', (req, res) => {
    if (!latestQR) {
        return res.send('QR no generado aún. Espera...');
    }
    // Genera una imagen en base64 del QR y la envía al navegador
    QRCode.toDataURL(latestQR, (err, url) => {
        if (err) return res.status(500).send('Error generando QR');
        res.send(`<img src="${url}" style="width:300px;">`);
    });
});

// Función para conectarse a WhatsApp
const connectToWhatsApp = async () => {
    // Se utiliza multi-file auth state para manejar la autenticación y almacenar credenciales en './auth_info'
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // Se crea el socket de WhatsApp
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Muestra el QR en la terminal para la autenticación
    });

    // Maneja eventos de actualización de la conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            latestQR = qr;
            console.log('QR actualizado. Escanea en: http://localhost:3000/qr');
        }
        
        if (connection === 'close') {
            // Si la desconexión no es por error 401 (autenticación), se reconecta
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ Connected to WhatsApp');
        }
    });

    // Guarda las credenciales cada vez que se actualizan
    sock.ev.on('creds.update', saveCreds);

    return sock;
};

app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000/qr'));

// Exporta la función para conectar a WhatsApp
module.exports = connectToWhatsApp;
