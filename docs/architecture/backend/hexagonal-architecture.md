# Arquitectura hexagonal del backend

**Estado:** decisión aceptada; el diseño físico se concretará después del modelo de dominio.

## Objetivo

Proteger las reglas de ventas, inventario, pagos y compras frente a detalles de NestJS, Prisma, PostgreSQL, HTTP y servicios externos.

## Regla de dependencia

```text
Adaptadores de entrada ──▶ Aplicación ──▶ Dominio
                                │
                                ▼
                       Puertos requeridos
                                ▲
                                │
Adaptadores de salida ──────────┘
```

Las dependencias de código apuntan hacia el interior. El dominio no importa infraestructura.

## Responsabilidades

| Zona | Responsabilidad | Ejemplos futuros |
| --- | --- | --- |
| Dominio | Reglas, estados, invariantes y comportamiento | Venta, Reserva, Dinero |
| Aplicación | Orquestar capacidades y dependencias | confirmar una venta, registrar un pago |
| Puertos de entrada | Contratos de capacidades ofrecidas | registrar ventas |
| Puertos de salida | Capacidades externas requeridas | persistir una venta, almacenar imágenes |
| Adaptadores de entrada | Traducir actores/protocolos hacia la aplicación | controladores NestJS |
| Adaptadores de salida | Traducir puertos hacia tecnología | Prisma, Cloudinary |
| Composición | Elegir e inyectar implementaciones concretas | módulos y providers NestJS |

## Reglas de implementación

- El dominio será TypeScript puro y no usará decoradores de NestJS o Prisma.
- Los controladores autentican, validan el contrato de entrada, delegan y traducen la respuesta.
- La lógica de negocio no vive en controladores, repositorios ni mapeadores.
- Los puertos se nombran por propósito de negocio, no por tecnología.
- No se crea una interfaz para cada clase; un puerto protege una frontera real.
- Los repositorios se diseñan para agregados, no para reflejar tablas.
- Prisma y sus tipos permanecen en adaptadores de salida.
- Las consultas de lectura que cruzan agregados pueden utilizar CQRS ligero y DTO optimizados.
- NestJS actúa como host y mecanismo de composición, no como dueño del dominio.
- Los resultados esperados de negocio se modelan explícitamente; las excepciones se reservan para fallos inesperados.

## Aplicación proporcional

Ventas e Inventario justifican modelado rico. Catálogo simple, categorías y configuración pueden utilizar una aplicación más delgada mientras respeten la dirección de dependencias. No se introducirán microservicios, event sourcing ni buses de eventos hasta que exista una necesidad demostrada.

## Testing esperado

- Dominio: pruebas de comportamiento e invariantes sin framework.
- Aplicación: pruebas de capacidades usando fakes de puertos requeridos.
- Adaptadores de salida: pruebas de integración con PostgreSQL u otros proveedores reales.
- Adaptadores de entrada: pruebas de contrato y transporte.
- Sistema: Playwright para flujos críticos completos.

