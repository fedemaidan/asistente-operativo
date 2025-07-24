// Importa la librería Baileys para conexión con WhatsApp
const {
  default: makeWASocket,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
// Importa Boom para el manejo de errores (opcional)
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
// Importa Express para exponer el QR vía web
const express = require("express");
const botSingleton = require("../botSingleton");
const users = require("../Usuarios/usuariosMap");
const app = express();

// Variable para almacenar el último QR generado (si se requiere)
let latestQR = null;

// Ruta para mostrar el QR en un navegador
app.get("/qr", (req, res) => {
  if (!latestQR) {
    return res.send("QR no generado aún. Espera...");
  }
  // Genera una imagen en base64 del QR y la envía al navegador
  QRCode.toDataURL(latestQR, (err, url) => {
    if (err) return res.status(500).send("Error generando QR");
    res.send(`<img src="${url}" style="width:300px;">`);
  });
});

// Función para conectarse a WhatsApp
const connectToWhatsApp = async () => {
  // Se utiliza multi-file auth state para manejar la autenticación y almacenar credenciales en './auth_info'
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  // Se crea el socket de WhatsApp
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // Muestra el QR en la terminal para la autenticación
  });

  // Maneja eventos de actualización de la conexión
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log("QR actualizado. Escanea en: http://localhost:3000/qr");
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log('🔌 Connection closed. Should reconnect:', shouldReconnect);
    
      try {
        if (shouldReconnect) {
          if (sock?.ws?.readyState !== 3) {
            sock?.ws?.close(); // Cerrá si aún no estaba cerrado
          }
    
          // Esperar 2 segundos antes de reconectar para evitar spam de reconexión
          await new Promise(resolve => setTimeout(resolve, 2000));
    
          return await connectToWhatsApp();
        } else {
          console.log('❌ Sesión inválida. Borrá auth_info y escaneá un nuevo QR.');
        }
      } catch (err) {
        console.error('❌ Error al intentar reconectar:', err);
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    }
  });    

  // Guarda las credenciales cada vez que se actualizan
  sock.ev.on("creds.update", saveCreds);

  await botSingleton.setSock(sock);

  botSingleton.setUsers(users);

  return sock;
};

app.listen(3002, () =>
  console.log("Servidor corriendo en http://localhost:3000/qr")
);

// Exporta la función para conectar a WhatsApp
module.exports = connectToWhatsApp;
