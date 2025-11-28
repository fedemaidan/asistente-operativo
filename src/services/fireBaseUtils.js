const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_CREDENTIALS)),
    storageBucket: process.env.GOOGLE_STORAGE_BUCKET
  });
  
const db = admin.firestore();

// Middleware de autenticación
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No se proporcionó un token válido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      next();  
  } catch (error) {
      if (error.code === 'auth/id-token-expired') {
        await refreshToken();
      }
      console.error('Error al verificar el token:', error);
      return res.status(403).json({ error: 'Token no válido o expirado.' });
  }
};

module.exports = { db, admin, authenticate };
