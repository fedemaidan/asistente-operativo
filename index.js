const connectToWhatsApp = require("./src/Utiles/Mensajes/whatsapp");
const express = require("express");
const cors = require("cors");
const { default: connectToMongoDB } = require("./src/DBConnection");

const startBot = async () => {
  const sock = await connectToWhatsApp();

  // Ejemplo de keep-alive
  setInterval(() => console.log("Keep-alive"), 5 * 60 * 1000);
};

const startApi = async () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.listen(3000, async () => {
    await connectToMongoDB();
    console.log("API running on port 3000");
  });
};

//startBot();
startApi();
