
async function BuscarHoja(userId, text) {
    try {
        const detalle =
        {
            "Hoja_Ruta": [
                {
                    "ID_CAB": "1e08a890",
                    "Fecha": "02/05/2024",
                    "Hora_Salida": "07:30",
                    "Cerrado": false,
                    "Detalles": [
                        {
                            "ID_DET": "DET00010",
                            "COD_CLI": "",
                            "Cliente": "Numasol SRL",
                            "Comprobante": {
                                "Letra": "A",
                                "Punto_Venta": "14",
                                "Numero": "15072"
                            },
                            "Direccion_Entrega": "Av. Monteverde 4050",
                            "Localidad": "Burzaco",
                            "Observaciones": "",
                            "Vendedor": "MANGINI VACCAREZZA: MATIAS",
                            "Condicion_Pago": "CC",
                            "Estado": "No entregado",
                            "Incidencia": "Conforme completo",
                            "Path": ""
                        },
                        {
                            "ID_DET": "DET00009",
                            "COD_CLI": "",
                            "Cliente": "Norberto Paez",
                            "Comprobante": {
                                "Letra": "B",
                                "Punto_Venta": "14",
                                "Numero": "32397"
                            },
                            "Direccion_Entrega": "Barbier 691",
                            "Localidad": "Monte Grande",
                            "Observaciones": "",
                            "Vendedor": "Fariñas Gil: Jeyfred Jose",
                            "Condicion_Pago": "Pagado",
                            "Estado": "No entregado",
                            "Incidencia": "Conforme completo",
                            "Path": ""
                        },
                        {
                            "ID_DET": "DET00003",
                            "COD_CLI": "",
                            "Cliente": "Enrique Romero",
                            "Comprobante": {
                                "Letra": "B",
                                "Punto_Venta": "14",
                                "Numero": "32386"
                            },
                            "Direccion_Entrega": "Brandsen 3124",
                            "Localidad": "Monte Grande",
                            "Observaciones": "",
                            "Vendedor": "VALLARIO: GUSTAVO IVAN",
                            "Condicion_Pago": "Pagado",
                            "Estado": "No entregado",
                            "Incidencia": "Conforme completo",
                            "Path": ""
                        },
                        {
                            "ID_DET": "DET00004",
                            "COD_CLI": "",
                            "Cliente": "Enrique Romero",
                            "Comprobante": {
                                "Letra": "B",
                                "Punto_Venta": "14",
                                "Numero": "32387"
                            },
                            "Direccion_Entrega": "Brandsen 3124",
                            "Localidad": "Monte Grande",
                            "Observaciones": "",
                            "Vendedor": "VALLARIO: GUSTAVO IVAN",
                            "Condicion_Pago": "Pagado",
                            "Estado": "No entregado",
                            "Incidencia": "Conforme completo",
                            "Path": ""
                        }
                    ]
                }
            ],
            "Cliente": {
                "Nombre": "Cactus / Bauhaus",
                "Telefono": "5491149380799"
            },
            "Vendedor": {
                "Nombre": "TROYANOVICH: NICOLAS FABIAN",
                "Telefono": "5491149380799"
            },
            "Chofer": {
                "Nombre": "FRIAS: BRAIAN MAURO",
                "Telefono": "5491149380799",
                "Patente": "OPN 326"
            }
        }

        return detalle;
    } catch (error) {
        console.error(`❌ Error al obetner la hoja`, error);
    }
}

module.exports = BuscarHoja;