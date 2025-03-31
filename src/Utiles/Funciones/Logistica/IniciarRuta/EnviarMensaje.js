
async function enviarMensaje(userId, text, sock) {
    try {
        await sock.sendMessage(userId, { text });
        console.log(`📩 Mensaje enviado a ${userId}: ${text}`);
    } catch (error) {
        console.error(`❌ Error al enviar mensaje a ${userId}:`, error);
    }
}

module.exports = enviarMensaje;