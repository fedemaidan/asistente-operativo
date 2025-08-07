const cajaController = require("./src/controllers/cajaController");

async function crearCajas() {
  console.log("Iniciando creación de cajas...");

  const cajas = [
    { nombre: "ENSHOP SRL" },
    { nombre: "ASOCIACION CULTURA MUTUAL" },
    { nombre: "EZE" },
    { nombre: "NICO" },
  ];

  for (const cajaData of cajas) {
    try {
      console.log(`Creando caja: ${cajaData.nombre}`);
      const resultado = await cajaController.createCaja(cajaData);

      if (resultado.success) {
        console.log(`✅ Caja "${cajaData.nombre}" creada exitosamente`);
        console.log(`   ID: ${resultado.data._id}`);
      } else {
        console.log(
          `❌ Error al crear caja "${cajaData.nombre}": ${resultado.error}`
        );
      }
    } catch (error) {
      console.log(
        `❌ Error inesperado al crear caja "${cajaData.nombre}": ${error.message}`
      );
    }
  }

  console.log("\nVerificando cajas creadas...");
  const todasLasCajas = await cajaController.getAllCajas();

  if (todasLasCajas.success) {
    console.log("📋 Lista de cajas existentes:");
    todasLasCajas.data.forEach((caja) => {
      console.log(`   - ${caja.nombre} (ID: ${caja._id})`);
    });
  } else {
    console.log(`❌ Error al obtener cajas: ${todasLasCajas.error}`);
  }
}

// Ejecutar el script
crearCajas()
  .then(() => {
    console.log("\n✅ Proceso completado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error en el proceso:", error);
    process.exit(1);
  });
