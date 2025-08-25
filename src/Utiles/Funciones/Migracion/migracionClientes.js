const clienteController = require("../../../controllers/clienteController");
const { getClientesFromSheet } = require("../../GoogleServices/Sheets/cliente");
require("../../../DBConnection");
const { parseNombreToUpperCase } = require("./migracionComprobantes");

async function migrarClientesDesdeGoogleSheets() {
  console.log("🚀 Iniciando migración de clientes desde Google Sheets...");

  try {
    console.log("📊 Obteniendo clientes desde Google Sheets...");
    const clientesFromSheet = await getClientesFromSheet(
      process.env.GOOGLE_SHEET_ID
    );

    let clientesCreados = 0;
    let clientesExistentes = 0;
    let errores = 0;

    for (const clienteSheet of clientesFromSheet) {
      try {
        // Verificar que el cliente tenga nombre
        if (!clienteSheet.nombre || clienteSheet.nombre.trim() === "") {
          console.log("⚠️ Cliente sin nombre, saltando...");
          errores++;
          continue;
        }

        // Preparar datos del cliente para MongoDB
        const clienteData = {
          nombre: parseNombreToUpperCase(clienteSheet.nombre.trim()),
          descuento: parseFloat(clienteSheet.descuento) || 0,
          ccActivas:
            clienteSheet.ccActivas && clienteSheet.ccActivas.length > 0
              ? clienteSheet.ccActivas
              : ["ARS"], // Default si no tiene ccActivas
          usuario: "Sistema",
        };

        // Validar descuento (debe estar entre 0 y 1)
        if (clienteData.descuento > 1) {
          console.log(
            `⚠️ Descuento de ${clienteData.nombre} es ${clienteData.descuento}, convirtiendo de porcentaje a factor`
          );
          clienteData.descuento = clienteData.descuento / 100;
        }

        // Validar ccActivas
        const cuentasValidas = ["ARS", "USD BLUE", "USD OFICIAL"];
        clienteData.ccActivas = clienteData.ccActivas.filter((cc) =>
          cuentasValidas.includes(cc)
        );

        if (clienteData.ccActivas.length === 0) {
          clienteData.ccActivas = ["ARS"]; // Default
        }

        console.log(
          `📝 Procesando cliente: ${
            clienteData.nombre
          }, ccActivas: ${JSON.stringify(clienteData.ccActivas)}, descuento: ${
            clienteData.descuento
          }`
        );

        const resultado = await clienteController.createCliente(clienteData);

        if (resultado.success) {
          clientesCreados++;
        } else {
          if (
            resultado.error &&
            resultado.error.includes("Ya existe un cliente")
          ) {
            console.log(`ℹ️ Cliente ya existe: ${clienteData.nombre}`);
            clientesExistentes++;
          } else {
            console.log(
              `❌ Error al crear cliente ${clienteData.nombre}: ${resultado.error}`
            );
            errores++;
          }
        }
      } catch (error) {
        console.log(`❌ Error procesando cliente: ${error.message}`);
        errores++;
      }
    }

    // Resumen de la migración
    console.log("\n📊 RESUMEN DE LA MIGRACIÓN:");
    console.log(`✅ Clientes creados: ${clientesCreados}`);
    console.log(`ℹ️ Clientes que ya existían: ${clientesExistentes}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(
      `📋 Total procesados: ${clientesCreados + clientesExistentes + errores}`
    );

    if (clientesCreados > 0) {
      console.log("\n🎉 Migración completada exitosamente");
    } else {
      console.log("\n⚠️ No se crearon nuevos clientes");
    }
  } catch (error) {
    console.error("💥 Error durante la migración:", error.message);
    throw error;
  }
}

module.exports = migrarClientesDesdeGoogleSheets;
