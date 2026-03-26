const {
  connectToWhatsApp,
  router: whatsappRouter,
} = require("./src/Utiles/Mensajes/whatsapp.js");
const express = require("express");
const cors = require("cors");
const { connectToMongoDB } = require("./src/DBConnection.js");

const indexRoutes = require("./src/routes/index.routes.js");

const PORT = 3002;

const startBot = async () => {
  const sock = await connectToWhatsApp();

  setInterval(() => console.log("Keep-alive"), 5 * 60 * 1000);
  return sock;
};

const main = async () => {
  await connectToMongoDB();

  const app = express();
  app.use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:4000",
        "http://127.0.0.1:3000",
        "http://137.184.68.197:3004",
        // "https://sorbydata.com",
        "https://admin.sorbydata.com",
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );
  app.use(express.json());

  app.use("/api", indexRoutes);
  app.use("/api/whatsapp", whatsappRouter);
  app.get("/", (req, res) => {
    res.json({ message: "API Bot Fundas funcionando correctamente" });
  });

  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });

  await startBot();
};

main().catch((err) => {
  console.error("Error al iniciar:", err);
  process.exitCode = 1;
});
