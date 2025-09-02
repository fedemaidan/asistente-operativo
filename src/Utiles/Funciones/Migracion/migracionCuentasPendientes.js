const mongoose = require("mongoose");

const ClienteController = require("../../../controllers/clienteController");
const CuentaPendienteController = require("../../../controllers/cuentaPendienteController");

function normalizarNombre(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") //
    .replace(/\s+/g, " ");
}

async function migrarCuentasPendientesConCliente({
  dryRun = false,
  incluirInactivas = true,
  pageSize = 5000,
  usuarioMigracion = "Sistema",
} = {}) {
  const respClientes = await ClienteController.getAll({}, "", {
    sort: { nombre: 1 },
  });
  if (respClientes?.success === false) {
    throw new Error(respClientes.error || "No se pudieron obtener clientes");
  }
  const clientes = respClientes.data || [];
  const mapaClientes = new Map();
  for (const c of clientes) {
    const key = normalizarNombre(c?.nombre);
    if (key) {
      if (!mapaClientes.has(key)) mapaClientes.set(key, c._id);
    }
  }
  console.log(
    `👥 Clientes cargados: ${clientes.length} (mapa: ${mapaClientes.size})`
  );

  const filter = incluirInactivas ? {} : { active: true };
  let offset = 0;
  let total = 0;

  let yaTenianCliente = 0;
  let sinNombre = 0;
  let sinMatchCliente = 0;
  let conMatch = 0;
  let actualizadas = 0;
  let errores = 0;

  do {
    const respPage = await CuentaPendienteController.getAllPaginado({
      filter,
      populate: "",
      sort: { _id: 1 }, // orden estable para paginado
      limit: pageSize,
      offset,
    });

    if (respPage?.success === false) {
      throw new Error(respPage.error || "Error al paginar cuentas pendientes");
    }

    const cuentas = respPage.data || [];
    total = respPage.total ?? total;
    if (offset === 0) {
      console.log(`📋 Cuentas pendientes totales: ${total}`);
    }
    if (cuentas.length === 0) break;

    for (const cuenta of cuentas) {
      try {
        if (cuenta?.cliente) {
          yaTenianCliente++;
          continue;
        }

        const nombreRef = normalizarNombre(cuenta?.proveedorOCliente);
        if (!nombreRef) {
          sinNombre++;
          continue;
        }

        const clienteId =
          mapaClientes.get(nombreRef) ||
          mapaClientes.get(nombreRef.toUpperCase()) ||
          mapaClientes.get(nombreRef.toLowerCase());

        if (!clienteId) {
          console.log(`❌ No se encontró cliente para ${nombreRef}`);
          sinMatchCliente++;
          continue;
        }

        conMatch++;
        if (dryRun) continue;

        const respUpd = await CuentaPendienteController.updateCuentaPendiente(
          cuenta._id,
          { cliente: clienteId, usuario: usuarioMigracion }
        );

        if (respUpd?.success === false) {
          throw new Error(respUpd.error || "Falló updateCuentaPendiente");
        }

        actualizadas++;
        console.log(`✅ Cuenta ${cuenta._id} asociada a cliente ${clienteId}`);
      } catch (e) {
        errores++;
        console.log(`❌ Error en cuenta ${cuenta?._id}: ${e.message}`);
      }
    }

    offset += cuentas.length;
  } while (offset < total);

  // 3) Resumen
  console.log("\n📊 RESUMEN MIGRACIÓN (solo controllers):");
  console.log(`🟦 Ya tenían cliente:      ${yaTenianCliente}`);
  console.log(`⚠️  Sin proveedorOCliente:  ${sinNombre}`);
  console.log(`⚠️  Sin match de cliente:   ${sinMatchCliente}`);
  console.log(`🔎 Con match de cliente:    ${conMatch}`);
  console.log(
    `✅ Actualizadas:            ${actualizadas}${dryRun ? " (dry-run)" : ""}`
  );
  console.log(`❌ Errores:                 ${errores}`);
  console.log(`📋 Total procesadas:        ${total}`);

  return {
    yaTenianCliente,
    sinNombre,
    sinMatchCliente,
    conMatch,
    actualizadas,
    errores,
    total,
    dryRun,
  };
}

if (require.main === module) {
  migrarCuentasPendientesConCliente({
    dryRun: false, // poné true para probar sin escribir
    incluirInactivas: true, // incluir también inactive
    pageSize: 1000,
    usuarioMigracion: "migracion@script",
  })
    .then(() => mongoose.connection.close())
    .catch((e) => {
      console.error("💥 Error en migración:", e);
      mongoose.connection.close();
      process.exit(1);
    });
}

module.exports = migrarCuentasPendientesConCliente;
