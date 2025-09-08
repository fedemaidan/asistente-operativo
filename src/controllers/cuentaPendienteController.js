const BaseController = require("./baseController");
const CuentaPendiente = require("../models/cuentaPendiente.model");
const Cliente = require("../models/cliente.model");
const migrarEntregasDesdeGoogleSheets = require("../Utiles/Funciones/Migracion/migracionEntregas");
const Movimiento = require("../models/movimiento.model");
const {
  migrarComprobantesDesdeGoogleSheets,
} = require("../Utiles/Funciones/Migracion/migracionComprobantes");

class CuentaPendienteController extends BaseController {
  constructor() {
    super(CuentaPendiente);
  }

  // Crear cuenta pendiente con validaciones específicas
  async createCuentaPendiente(cuentaData) {
    try {
      return await this.create(cuentaData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar cuenta pendiente con usuario para logs
  async updateCuentaPendiente(id, cuentaData) {
    try {
      const { usuario, ...datosCuenta } = cuentaData;

      const updateData = {
        ...datosCuenta,
        usuario: usuario,
      };

      return await this.update(id, updateData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cuentas pendientes por proveedor/cliente
  async getByProveedorOCliente(proveedorOCliente, includeInactive = false) {
    try {
      const query = {
        proveedorOCliente: new RegExp(proveedorOCliente, "i"),
      };

      if (!includeInactive) {
        query.active = true;
      }

      const cuentas = await this.model.find(query).sort({ fechaCuenta: -1 });

      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cuentas pendientes por moneda
  async getByMoneda(moneda, includeInactive = false) {
    try {
      const query = { moneda };

      if (!includeInactive) {
        query.active = true;
      }

      const cuentas = await this.model.find(query).sort({ fechaCuenta: -1 });
      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener cuentas pendientes por rango de fechas
  async getByFechaRange(fechaInicio, fechaFin, includeInactive = false) {
    try {
      const query = {
        fechaCuenta: {
          $gte: new Date(fechaInicio),
          $lte: new Date(fechaFin),
        },
      };

      if (!includeInactive) {
        query.active = true;
      }

      const cuentas = await this.model.find(query).sort({ fechaCuenta: -1 });

      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Calcular total de cuentas pendientes por moneda
  async getTotalByMoneda(moneda, includeInactive = false) {
    try {
      const matchStage = { moneda };

      if (!includeInactive) {
        matchStage.active = true;
      }

      const result = await this.model.aggregate([
        { $match: matchStage },
        { $group: { _id: null, total: { $sum: "$montoTotal" } } },
      ]);

      const total = result.length > 0 ? result[0].total : 0;
      return { success: true, data: total };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas de cuentas pendientes
  async getEstadisticas(includeInactive = false) {
    try {
      const query = {};
      if (!includeInactive) {
        query.active = true;
      }

      const totalCuentas = await this.model.countDocuments(query);
      const totalARS = await this.getTotalByMoneda("ARS", includeInactive);
      const totalUSD = await this.getTotalByMoneda("USD", includeInactive);

      return {
        success: true,
        data: {
          totalCuentas,
          totalARS: totalARS.data,
          totalUSD: totalUSD.data,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getByClienteId(clienteId, populate = "", includeInactive = false) {
    try {
      // Primero obtenemos el cliente para obtener su nombre
      const Cliente = require("../models/cliente.model");
      const cliente = await Cliente.findById(clienteId);
      if (!cliente) {
        return { success: false, error: "Cliente no encontrado" };
      }

      // Normalizamos el nombre del cliente para la búsqueda
      const nombreCliente = cliente.nombre.toString().trim().toLowerCase();

      // Buscamos cuentas pendientes donde proveedorOCliente coincida con el nombre del cliente
      const query = {
        $expr: {
          $eq: [
            { $toLower: { $trim: { input: "$proveedorOCliente" } } },
            nombreCliente,
          ],
        },
      };

      if (!includeInactive) {
        query.active = true;
      }

      let cuentas;
      cuentas = await this.model
        .find(query)
        .populate(populate)
        .sort({ fechaCuenta: -1 });

      if (cuentas.length === 0) {
        console.log(
          "No se encontraron cuentas pendientes para el cliente",
          clienteId,
          cliente.nombre
        );
        cuentas = await this.model
          .find({ proveedorOCliente: cliente.nombre })
          .populate(populate)
          .sort({ fechaCuenta: -1 });
      }

      return { success: true, data: cuentas };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async migracionEntregasMonto() {
    await this.deleteTEST();

    await migrarEntregasDesdeGoogleSheets(
      "1zf7cetDmaKG59vGMI9Dlb2D7SVCijEk-6xiL7GRyWqo"
    );
  }

  async deleteTEST() {
    await this.model.updateMany(
      {
        fechaCreacion: {
          $gt: new Date("2025-09-02T12:32:23.290Z"),
        },
        usuario: "Sistema",
      },
      {
        $set: {
          active: false,
          usuario: "Sistema Backup",
        },
      }
    );
  }

  // Obtener logs de una cuenta pendiente
  async getLogs(id) {
    try {
      const cuenta = await this.model.findById(id).select("logs");
      if (!cuenta) {
        return { success: false, error: "Cuenta pendiente no encontrada" };
      }
      return { success: true, data: cuenta.logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Eliminar lógicamente una cuenta pendiente
  async deleteCuentaPendiente(id, usuario) {
    try {
      const result = await this.model.findByIdAndUpdate(
        id,
        {
          active: false,
          usuario: usuario || "Sistema",
        },
        { new: true }
      );

      if (!result) {
        return { success: false, error: "Cuenta pendiente no encontrada" };
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateSigno(id) {
    try {
      // Primero obtenemos el documento actual
      const cuenta = await this.model.findById(id);
      if (!cuenta) {
        return { success: false, error: "Cuenta pendiente no encontrada" };
      }

      // Multiplicamos subtotal y montoTotal por -1
      const updateData = {
        subTotal: {
          ars: cuenta.subTotal.ars * -1,
          usdOficial: cuenta.subTotal.usdOficial * -1,
          usdBlue: cuenta.subTotal.usdBlue * -1,
        },
        montoTotal: {
          ars: cuenta.montoTotal.ars * -1,
          usdOficial: cuenta.montoTotal.usdOficial * -1,
          usdBlue: cuenta.montoTotal.usdBlue * -1,
        },
      };

      const result = await this.model.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
      throw error;
    }
  }

  async migracionClientesPerdidos() {
    const cuentas = await this.model.find({ cliente: null, active: true });

    let actualizadas = 0;
    let errores = 0;
    for (const cuenta of cuentas) {
      const cliente = await Cliente.findOne({
        nombre: {
          $in: [
            cuenta.proveedorOCliente.trim().toUpperCase(),
            cuenta.proveedorOCliente.trim().toLowerCase(),
            cuenta.proveedorOCliente.trim(),
            cuenta.proveedorOCliente,
          ],
        },
      });
      if (cliente) {
        const respUpd = await this.updateCuentaPendiente(cuenta._id, {
          cliente: cliente._id,
          usuario: cuenta.usuario,
        });
        if (respUpd?.success === false) {
          errores++;
          console.log(`❌ Error en cuenta ${cuenta?._id}: ${respUpd.error}`);
        }
        actualizadas++;
        console.log(
          `✅ Cuenta ${cuenta._id} asociada a cliente ${cliente._id}`
        );
      }
    }

    return { success: true, data: cuentas, actualizadas, errores };
  }
}

module.exports = new CuentaPendienteController();
