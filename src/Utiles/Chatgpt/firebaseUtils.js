const admin = require("firebase-admin");
require("dotenv").config();

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(credentials),
  storageBucket: "factudata-3afdf.appspot.com",
});

const db = admin.firestore();

module.exports = { admin, db };
