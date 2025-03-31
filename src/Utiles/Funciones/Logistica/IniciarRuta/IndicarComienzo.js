const enviarMensaje = require('../IniciarRuta/EnviarMensaje');
const GuardarEstadoChofer = require('../../Chofer/GuardarEstadoChofer');
// @s.whatsapp.net
module.exports = async function IndicarComienzo(hojaRuta, sock) {
    try {
        if (!hojaRuta || !hojaRuta.Hoja_Ruta || hojaRuta.Hoja_Ruta.length === 0) {
            console.error("❌ Error: Hoja de ruta no proporcionada o vacía.");
            return;
        }

        // Extraer la primera hoja de ruta
        const hoja = hojaRuta.Hoja_Ruta[0];
        const { ID_CAB, Detalles = [] } = hoja;
        const { Cliente, Vendedor, Chofer } = hojaRuta;

        if (!Detalles || Detalles.length === 0) {
            console.error("❌ Error: No hay detalles en la hoja de ruta.");
            return;
        }

        // 🏡 📩 Mensaje para el Cliente
        if (Cliente?.Telefono) {
            const mensajeCliente = `📦 *Estimado/a ${Cliente.Nombre},* su pedido llegará *hoy*. 📅\nLo mantendremos informado sobre su estado y ubicación en tiempo real. 🚚✨`;
            await enviarMensaje(Cliente.Telefono+"@s.whatsapp.net", mensajeCliente, sock);
        } else {
            console.error("⚠️ No se pudo enviar mensaje al Cliente: Teléfono no disponible.");
        }

        // 📈 📩 Mensaje para el Vendedor
        if (Vendedor?.Telefono) {
            const mensajeVendedor = `📌 *Atención ${Vendedor.Nombre}*, el pedido *${ID_CAB}* del cliente *${Cliente.Nombre}* ya está en proceso de envío. 📦✅`;
            await enviarMensaje(Vendedor.Telefono+"@s.whatsapp.net", mensajeVendedor, sock);
        } else {
            console.error("⚠️ No se pudo enviar mensaje al Vendedor: Teléfono no disponible.");
        }

        // 🚛 📩 Mensaje para el Chofer con lista de entregas
        if (Chofer?.Telefono) {
            let mensajeChofer = `🚛 *Hola ${Chofer.Nombre}*, tenés que realizar las siguientes entregas para la hoja *${ID_CAB}*:\n\n`;

            Detalles.forEach((detalle, index) => {
                mensajeChofer += `${index + 1}. 📍 *Dirección:* ${detalle.Direccion_Entrega || "No especificada"}, *Localidad:* ${detalle.Localidad || "No especificada"}\n`;
            });

            mensajeChofer += "\n🚛 *Elije tu proximo destino y manos a la obra*";
            await enviarMensaje(Chofer.Telefono + "@s.whatsapp.net", mensajeChofer, sock);

            //guardar el step y flow del chofer en la bd para evitar que se caiga su flujo a lo largo del dia evitando perdida de datos.
            await GuardarEstadoChofer(Chofer.Telefono + "@s.whatsapp.net", hojaRuta,"PrimeraEleccionEntrega")

        } else {
            console.error("⚠️ No se pudo enviar mensaje al Chofer: Teléfono no disponible.");
        }

        console.log("✅ Todos los mensajes han sido enviados correctamente.");
        return { Success: true, id: ID_CAB };
    } catch (error) {
        console.error("❌ Error en IndicarComienzo:", error);
        return { Success: false, msg: error.message };
    }
};

