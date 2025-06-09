const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { admin } = require('./services/firebase/firebaseUtils');
const QRCode = require('qrcode');

const bucket = admin.storage().bucket();
const app = express();
let latestQR = null;

const authDir = path.resolve('./auth');

app.get('/qr', (req, res) => {
    if (!latestQR) {
        return res.send('QR no generado aún. Espera...');
    }

    QRCode.toDataURL(latestQR, (err, url) => {
        if (err) return res.status(500).send('Error generando QR');
        res.send(`<img src="${url}" style="width:300px;">`);
    });
});

const connectToWhatsApp = async () => {
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    const sock = makeWASocket({ auth: state });
    
    sock.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            latestQR = qr;
            console.log('QR actualizado. Escanea en: http://localhost:3000/qr');
        }

        if (connection === 'close') {
            console.log('Conexión cerrada. Reintentando...');
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('🚫 Se requiere reautenticación manual.');
            }

        } else if (connection === 'open') {
            console.log('Conectado a WhatsApp');
        }
    });

    sock.ev.on('creds.update', saveCreds);
    return sock;
};

app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000/qr'));

module.exports = {connectToWhatsApp};
