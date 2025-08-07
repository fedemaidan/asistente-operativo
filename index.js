const {
  connectToWhatsApp,
  router: whatsappRouter,
} = require("./src/Utiles/Mensajes/whatsapp");
const express = require("express");
const cors = require("cors");
const connectToMongoDB = require("./src/DBConnection");

const indexRoutes = require("./src/routes/index.routes.js");

PORT = 3002;

const startBot = async () => {
  const sock = await connectToWhatsApp();

  setInterval(() => console.log("Keep-alive"), 5 * 60 * 1000);
};

const startApi = async () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api", indexRoutes);
  app.use("/api/whatsapp", whatsappRouter);
  app.get("/", (req, res) => {
    res.json({ message: "API Bot Fundas funcionando correctamente" });
  });

  app.listen(PORT, async () => {
    await connectToMongoDB();
    console.log(`API running on port ${PORT}`);
  });
};

startBot();
startApi();
