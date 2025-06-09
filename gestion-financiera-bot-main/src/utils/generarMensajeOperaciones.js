// helpers.js
const { formatCurrency } = require("./formatCurrency");

function generarMensajeCheque(cheque, index, flowData, descuento) {
  return (
    `✅ Cheque ${index + 1}:

` +
    `- *Monto*: ${formatCurrency(cheque.monto) || "No detectado"}\n` +
    `- *Número de comprobante*: ${
      cheque.numero_comprobante || "No detectado"
    }\n` +
    `- *Banco emisor*: ${cheque.banco_emisor || "No detectado"}\n` +
    `- *Cliente Emisor*: ${flowData.clienteEmisor || "No especificado"}\n` +
    `- *Cliente Receptor*: ${flowData.clienteReceptor || "No especificado"}\n` +
    `- *Tipo de Cheque*: ${cheque.tipoCheque}\n\n` +
    `Resumen de descuentos:\n` +
    `- Descuento Cheque (1.8%): ${formatCurrency(cheque.descuentoGeneral)}\n` +
    `- Descuento ${cheque.tipoCheque} (${descuento}%): ${formatCurrency(
      cheque.descuento
    )}\n` +
    `- **Total a recibir**: ${formatCurrency(cheque.total)}\n\n`
  );
}

function generarResumenOperacion(montoTotal) {
  return (
    `💰 *Total de la operación:* ${formatCurrency(montoTotal)}\n\n` +
    `Confirmar si los datos están correctos:\n\n` +
    `1️⃣ Si, continuemos\n2️⃣ No, modificar un cheque`
  );
}

function generarMensajeTransferencia(transferencia, flowData) {
  return (
    `✅ He detectado los siguientes datos de la transferencia:\n\n` +
    `- *Monto*: ${formatCurrency(transferencia.monto) || "No detectado"}\n` +
    `- *Número de comprobante*: ${
      transferencia.numero_comprobante || "No detectado"
    }\n` +
    `- *Banco emisor*: ${transferencia.banco_emisor || "No detectado"}\n`
  ); //+
  // `- *Cliente Emisor*: ${flowData.clienteEmisor || 'No especificado'}\n` +
  // `- *Cliente Receptor*: ${flowData.clienteReceptor || 'No especificado'}\n\n` +
  // `¿Deseas confirmar esta operación?\n\n1️⃣ Confirmar\n2️⃣ Cancelar\n3️⃣ Modificar algún dato`;
}

function generarMensajeSeleccionProveedor(proveedores) {
  if (proveedores.length === 0) {
    return "No se encontraron proveedores. Escribe el nombre manualmente.";
  }

  let mensaje = "Selecciona un proveedor:\n\n";
  proveedores.forEach((prov, index) => {
    mensaje += `${index + 1}️⃣ ${prov.nombre}\n`;
  });

  mensaje += `\nO escribe el nombre manualmente si no está en la lista.`;
  return mensaje;
}

function generarMensajeConfirmacionOperacion(flowData, comprobante) {
  return (
    `✅ Perfecto, estos son los datos recopilados:\n\n` +
    `- *Monto*: ${formatCurrency(comprobante.monto) || "No detectado"}\n` +
    `- *Número de comprobante*: ${
      comprobante.numero_comprobante || "No detectado"
    }\n` +
    `- *Banco emisor*: ${comprobante.banco_emisor || "No detectado"}\n` +
    `- *Cliente Emisor*: ${flowData.clienteEmisor || "No especificado"}\n` +
    `- *Cliente Receptor*: ${flowData.clienteReceptor || "No especificado"}\n` +
    `- *Tipo de Cheque*: ${comprobante.tipoCheque}\n\n` +
    `Resumen de descuentos:\n` +
    `- Descuento transferencia (2%): ${formatCurrency(
      comprobante.descuentoGeneral
    )}\n` +
    `- Descuento transferencia (1%): ${formatCurrency(
      comprobante.descuento
    )}\n` +
    `- **Total a recibir**: ${formatCurrency(comprobante.total)}\n\n` +
    // `¿Deseas confirmar esta operación?\n\n1️⃣ Confirmar\n2️⃣ Cancelar\n3️⃣ Modificar algún dato`;
    `¿Deseas confirmar esta operación?\n\n1️⃣ Confirmar\n2️⃣ Cancelar`
  );
}

function generarMensajeModificacion(flowData, comprobante) {
  return (
    `✅ Modificación aplicada:\n\n` +
    `- *Monto:* ${formatCurrency(comprobante.monto)}\n` +
    `- *Banco:* ${comprobante.banco_emisor}\n` +
    `- *Número:* ${comprobante.numero_comprobante}\n` +
    `- *Fecha de pago:* ${comprobante.fecha_pago}\n\n` +
    `Confirme si los datos son correctos:\n\n1️⃣ Si, continuemos\n2️⃣ No, modificar otro cheque`
  );
}

module.exports = {
  generarMensajeCheque,
  generarResumenOperacion,
  generarMensajeTransferencia,
  generarMensajeSeleccionProveedor,
  generarMensajeConfirmacionOperacion,
  generarMensajeModificacion,
};
