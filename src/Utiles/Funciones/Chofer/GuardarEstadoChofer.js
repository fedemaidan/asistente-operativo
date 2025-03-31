const FlowManager = require('../../../FlowControl/FlowManager')

module.exports = async function GuardarEstadoChofer(userId,hojaRuta,step) {
    try {

        if (!hojaRuta || !hojaRuta.Hoja_Ruta || hojaRuta.Hoja_Ruta.length === 0) {
            console.error("❌ Error: Hoja de ruta no proporcionada o vacía.");
            return;
        }
        const hoja = hojaRuta.Hoja_Ruta[0];
        const { ID_CAB, Detalles = [] } = hoja;


        // Rvisar modificaciones con el original comparando ambos json
        //*
        //*
        //*
        //*
        //*
        //*

        //guardar actualizaciones y proseguir
        //*
        //*
        //*
        //*
        //*
        //*
        //*
        //*



        // GUARDAR EL ESTADO DEL CHOFER EN LA BASE DE DATOS CON SU FLOW Y STEPS ACTUAL
        FlowManager.setFlow(userId, "ENTREGACHOFER", step, hojaRuta);
        return { Success: true, id: ID_CAB };
    } catch (error) {
        console.error("❌ Error en IndicarComienzo:", error);
        return { Success: false, msg: error.message };
    }
};

