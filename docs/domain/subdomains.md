# Subdominios de Nova

**Estado:** clasificación inicial confirmada el 2026-08-08.

## Visión del dominio central

El dominio central de Nova es controlar de forma trazable las ventas y las deudas de clientes. El modelo debe conservar qué se acordó, qué se entregó o separó, cuánto se cobró, cuánto continúa pendiente y por qué una operación terminó, cambió o fue devuelta.

Inventario, caja y analítica deben proporcionar información confiable a este núcleo, pero no reemplazan su propósito principal.

## Dominio central

### Ventas y cumplimiento

Responsable de:

- venta y líneas de venta;
- total y precios acordados;
- separaciones;
- entregas totales o parciales;
- ajustes autorizados del acuerdo;
- anulaciones;
- devoluciones comerciales.

Contiene reglas propias del negocio y cambia según los acuerdos reales con clientes.

### Cobros y cuentas por cobrar

Responsable de:

- pagos totales o parciales;
- acuerdos informales de pago;
- saldo pendiente;
- vencimiento informativo;
- monto condonado;
- cierre incompleto;
- deuda consolidada por cliente.

Es la prioridad principal del producto porque actualmente las deudas dependen de cuadernos y memoria.

## Subdominios de soporte

| Subdominio | Responsabilidad | Nivel de modelado esperado |
| --- | --- | --- |
| Inventario | Existencia física, reserva, disponibilidad, entrega, traslado, baja y ajuste por ubicación | Alto por sus invariantes, aunque sirve al dominio central |
| Catálogo y precios | Productos, clasificación, imágenes y precios de referencia | Moderado |
| Clientes | Identificación, datos sensibles, historial y fusión de duplicados | Moderado |
| Abastecimiento | Compras, proveedores, anticipos e ingresos de mercancía | Moderado |
| Caja y gastos | Entradas y salidas reales de dinero, gastos y reembolsos | Moderado |
| Analítica | Ventas, cobros, margen, rentabilidad, stock y desempeño por usuario | Lecturas derivadas; evitar modelo transaccional innecesario |
| Autorización | Reglas sobre qué acciones puede ejecutar cada rol | Moderado y explícito |

Inventario recibe un nivel alto de cuidado porque una inconsistencia física puede invalidar una venta, aunque no sea la prioridad principal elegida por el negocio.

## Subdominios genéricos

| Capacidad | Estrategia |
| --- | --- |
| Autenticación y sesiones | Utilizar mecanismos estándar y mantenerlos fuera del dominio comercial |
| Hash de contraseñas | Biblioteca segura; no implementar criptografía propia |
| Almacenamiento de imágenes | Cloudinary mediante un adaptador |
| Persistencia | PostgreSQL y Prisma como detalles externos al núcleo |
| Importación inicial | Herramienta atómica y desechable de inicialización |
| Logging y observabilidad | Infraestructura transversal |
| Notificaciones futuras | Proveedor o adaptador reemplazable |

## Criterio de inversión

- Profundidad máxima en ventas y cuentas por cobrar.
- Invariantes rigurosas en inventario por su impacto directo en las ventas.
- Modelos sencillos en catálogo, configuración y capacidades administrativas.
- Soluciones estándar para capacidades genéricas.
- Ninguna clasificación obliga a crear un microservicio o despliegue independiente.

## Revisión futura

La clasificación debe revisarse si el negocio cambia. Por ejemplo, una operación con múltiples tiendas podría elevar optimización logística e inventario a parte del dominio central.

