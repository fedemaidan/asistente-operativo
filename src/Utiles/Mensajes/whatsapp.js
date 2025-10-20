// src/Utiles/Mensajes/whatsapp.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,   // 👈 NECESARIO (versión oficial web)
  Browsers,                    // 👈 NECESARIO (UA realista)
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const QRCode = require('qrcode')
const express = require('express')

const botSingleton = require('../botSingleton')
const users = require('../Usuarios/usuariosMap')

const AUTH_DIR = './auth_info'
const router = express.Router()

let latestQR = null
let sock = null
let reconnecting = false
let backoffMs = 5_000  // backoff exponencial (5s, 10s, 20s, ...)

router.get('/qr', async (req, res) => {
  if (!latestQR) return res.status(503).send('QR no generado aún. Probá en 5s...')
  try {
    const dataUrl = await QRCode.toDataURL(latestQR)
    res.send(`<img src="${dataUrl}" style="width:300px">`)
  } catch {
    res.status(500).send('Error generando QR')
  }
})

async function connectToWhatsApp () {
  if (reconnecting) return sock
  reconnecting = true
  try {
    // Estado multi-file (mantiene sesiones en carpeta)
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

    // ⚠️ Versión oficial de WhatsApp Web (evita des-sincronizaciones)
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log('WA version ->', version, 'latest?', isLatest)

    // Crear socket con opciones recomendadas
    sock = makeWASocket({
      version,                                    // 👈 CRÍTICO
      auth: state,
      browser: Browsers.macOS('Google Chrome'),   // 👈 UA válido
      printQRInTerminal: false,                   // usamos la ruta /qr
      markOnlineOnConnect: false,
      syncFullHistory: false,                     // arranque más liviano
      connectTimeoutMs: 30_000,
      keepAliveIntervalMs: 20_000,
    })

    // Persistir credenciales
    sock.ev.on('creds.update', saveCreds)

    // Estado conexión / QR / reconexión
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr, pairingCode }) => {
      if (qr) latestQR = qr
      if (pairingCode) console.log('Pairing code:', pairingCode)

      if (connection === 'open') {
        console.log('✅ Connected to WhatsApp')
        latestQR = null
        backoffMs = 5_000
        reconnecting = false
      }

      if (connection === 'close') {
        const err = lastDisconnect?.error
        const boom = err instanceof Boom ? err : new Boom(err)
        const status = boom?.output?.statusCode || boom?.data?.statusCode || err?.status || err?.code
        console.log('🔴 Closed. status:', status, 'msg:', boom?.message)

        // 401 => sesión inválida / removida del teléfono: requiere re-vincular
        const shouldReconnect = status !== 401
        if (shouldReconnect) {
          const wait = Math.min(backoffMs, 60_000)
          console.log(`⏳ Reintentando en ${Math.round(wait / 1000)}s...`)
          setTimeout(() => {
            reconnecting = false
            backoffMs *= 2
            connectToWhatsApp().catch(() => {})
          }, wait)
        } else {
          reconnecting = false
          console.log('⚠️ Sesión inválida: escaneá nuevamente el QR en /api/whatsapp/qr')
        }
      }
    })

    // 👉 Integramos tu singleton exactamente como lo venías haciendo
    await botSingleton.setSock(sock)
    botSingleton.setUsers(users)

    return sock
  } catch (e) {
    console.error('connectToWhatsApp error:', e?.message || e)
    reconnecting = false
    throw e
  }
}

function getSock () { return sock }

module.exports = { router, connectToWhatsApp, getSock }
