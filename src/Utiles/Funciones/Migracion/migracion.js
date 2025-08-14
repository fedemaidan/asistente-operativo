const migrarClientesDesdeGoogleSheets = require("./migracionClientes");
const migrarComprobantesDesdeGoogleSheets = require("./migracionComprobantes");
const migrarEntregasDesdeGoogleSheets = require("./migracionEntregas");

async function ejecutarMigracion(_req, res) {
  try {
    await migrarClientesDesdeGoogleSheets();

    const resultadoComprobantes = await migrarComprobantesDesdeGoogleSheets(
      process.env.GOOGLE_SHEET_ID
    );

    const resultadoEntregas = await migrarEntregasDesdeGoogleSheets(
      process.env.GOOGLE_SHEET_ID
    );

    res.json({
      success: true,
      message: "🏁 Proceso de migración finalizado",
      comprobantes: resultadoComprobantes,
      entregas: resultadoEntregas,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  migrarClientesDesdeGoogleSheets,
  migrarComprobantesDesdeGoogleSheets,
  migrarEntregasDesdeGoogleSheets,
  ejecutarMigracion,
};
