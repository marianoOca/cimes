# Manual de Usuario WEBHOOKS - Integración De Plataformas Externas

Este manual describe cómo configurar la integración y que datos se enviaran en cada evento

Los eventos se enviarán por método POST con un JSON en el BODY conteniendo la información,
y se espera que siempre reciban un resultado con estado 200 (HTTP OK). En caso de no recibir
un estado 200, se intentará nuevamente el envío hasta un máximo de 5 intentos, con un
tiempo de delay entre cada intento, sumando un total de 3:20 minutos (+ el tiempo de demora
de la plataforma externa). El delay se incrementará entre cada intento según la siguiente tabla:

| Intento N° | Delay                                 |
| ---------- | ------------------------------------- |
| 1          | Inmediato                             |
| 2          | 5 segundos después del intento N° 1   |
| 3          | 15 segundos después del intento N° 2  |
| 4          | 45 segundos después del intento N° 3  |
| 5          | 135 segundos después del intento N° 4 |

La respuesta puede o no contener información, y que quedará registrada para auditar.

## Eventos

El sistema contempla 3 tipos de eventos para notificar

### Cambio de estado del cliente (CambioDeEstado)

Cuando un cliente cambia de estado, se enviará una notificación al sistema externo que contendrá un objeto con la siguiente forma:

```json
{
    "clienteId": 14884,
    "nombreCliente": "NOMBRE CLIENTE",
    "estadoAnterior": "Borrador",
    "estadoNuevo": "Activo",
    "estadoAnteriorId": 5,
    "estadoNuevoId": 1,
    "contactos": [
        {
            "nombrePersona": "NOMBRE CONTACTO",
            "email": "",
            "sectorContacto": "Gerente",
            "celular": "11-12345678",
            "contactoPrincipal": true
        }
    ]
}
```

### Registro de Visita en Cliente desde Móvil (VentaTemporal)

Cuando un repartidor registra una visita al cliente, y sincroniza esta visita desde el móvil, se enviará una notificación al recurso configurado para “VentaTemporal” del sistema externo, que contendrá un objeto con la siguiente forma:

```json
{
    "clienteId": 14884,
    "ausente": false,
    "ventaEntrega": true,
    "cobro": false,
    "devolucionArticulo": false,
    "movimientoEnvases": false,
    "fechaHora": "2026-01-30T01:12:00",
    "distanciaMtrs": 90,
    "contactos": [
        {
            "nombrePersona": "VILLANUEVA OLGA",
            "email": "",
            "sectorContacto": "Gerente",
            "celular": "11-25079045",
            "contactoPrincipal": true
        }
    ]
}
```

### Nuevas Alertas en Clientes (AlertasDeClientes)

Luego de generadas las alertas del día, todas aquellas alertas que no hayan existido el dia anterior en los clientes, se agruparán por cliente, y se enviará una notificación al recurso “AlertasDeClientes” del sistema externo, conteniendo un objeto con la siguiente forma:

```json
[
    {
        "clienteId": 18348,
        "cliente": "NOMBRE CLIENTE",
        "fechaUtlimaEntrega": "2026-01-22T14:50:00",
        "fechaUltimoCobroFactura": "2026-01-22T00:00:00",
        "saldos": {
            "saldoFacturas": 0,
            "consumosSinFacturar": 6000,
            "saldoFinal": 0
        },
        "stockEnvases": [
            {
                "articulo_id": 8,
                "nombreArticulo": "NOMBRE ARTICULO",
                "stockActual": 2
            }
        ],
        "contactos": [
            {
                "nombrePersona": "NOMBRE CONTACTO",
                "email": "",
                "sectorContacto": "Gerente",
                "celular": "11-12345678",
                "contactoPrincipal": true
            }
        ],
        "alertas": [
            {
                "tipo": 5,
                "descripcion": "Retiro de envases",
                "bloqueaCuenta": false
            }
        ]
    },
    {
        "clienteId": 18343,
        "cliente": "NOMBRE CLIENTE",
        "fechaUtlimaEntrega": "2026-01-22T14:50:00",
        "fechaUltimoCobroFactura": "2026-01-22T00:00:00",
        "saldos": {
            "saldoFacturas": 0,
            "consumosSinFacturar": 6000,
            "saldoFinal": 0
        },
        "stockEnvases": [
            {
                "articulo_id": 8,
                "nombreArticulo": "NOMBRE ARTICULO",
                "stockActual": 2
            }
        ],
        "contactos": [
            {
                "nombrePersona": "NOMBRE CONTACTO",
                "email": "",
                "sectorContacto": "Gerente",
                "celular": "11-12345678",
                "contactoPrincipal": true
            }
        ],
        "alertas": [
            {
                "tipo": 5,
                "descripcion": "Retiro de envases",
                "bloqueaCuenta": false
            }
        ]
    }
]
```
