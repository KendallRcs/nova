# Arquitectura de información

**Estado:** estructura inicial confirmada para desarrollar wireframes.

## Modelo de navegación

Nova conserva el mismo mapa conceptual en móvil y escritorio. Cambia el contenedor,
no los nombres ni la ubicación mental de las capacidades.

### Navegación principal compartida

1. **Inicio** — tareas rápidas, alertas y actividad relevante para el perfil.
2. **Ventas** — borradores, ventas confirmadas, cobros, entregas, cierres,
   cancelaciones y devoluciones permitidas.
3. **Inventario** — consulta de stock y movimientos; administración adicional según
   permisos.
4. **Clientes** — búsqueda, registro y cuenta consolidada.
5. **Más** — capacidades menos frecuentes y cuenta personal.

En móvil estos cinco destinos forman la navegación inferior. `Más` abre una lista
con texto e iconos secundarios; nunca una cuadrícula de símbolos sin explicación.
En escritorio los destinos y las capacidades de `Más` se despliegan en una barra
lateral agrupada.

### Capacidades administrativas dentro de Más

| Grupo | Destinos |
| --- | --- |
| Mercadería | Catálogo, Compras y anticipos |
| Finanzas | Gastos, Reportes |
| Administración | Usuarios, Carga inicial |
| Soporte | Centro de ayuda, Mi cuenta, Cerrar sesión |

La carga inicial desaparece de los accesos frecuentes después de completarse, pero
su resultado permanece consultable. No se muestra a empleados.

## Inicio adaptado por perfil

### Empleado

Orden de prioridad:

1. `Nueva venta` como acción principal;
2. búsqueda directa por código o nombre;
3. ventas propias que requieren cobro o entrega;
4. actividad reciente propia;
5. acceso a la explicación del flujo de venta.

El empleado no recibe métricas financieras, costos, márgenes ni alertas sobre
operaciones que no puede resolver.

### Administrador

Orden de prioridad:

1. alertas accionables: deudas vencidas, stock que requiere revisión y operaciones
   administrativas pendientes;
2. accesos rápidos a venta, compra, gasto y ajuste de inventario;
3. resumen mensual con enlace a Reportes;
4. actividad reciente de todo el negocio;
5. tareas de configuración solo cuando correspondan, como la carga inicial.

Los indicadores enlazan al conjunto filtrado que los explica. Un número sin camino
hacia su detalle no ocupa la portada.

## Estructura común de un módulo

```text
Encabezado
├── Nombre del módulo
├── Explicación breve del alcance
├── Cómo funciona
└── Acción principal permitida

Herramientas
├── Buscar
├── Filtros frecuentes
└── Filtros adicionales

Contenido
├── Resumen accionable, si aporta una decisión
├── Lista, tabla o formulario adaptado al dispositivo
└── Paginación o carga siguiente explícita

Contexto
├── Estado vacío / carga / error
└── Ayuda contextual y consecuencias
```

## Adaptación móvil y escritorio

| Necesidad | Móvil | Escritorio |
| --- | --- | --- |
| Navegación | barra inferior fija | barra lateral persistente |
| Listados | filas apiladas con datos prioritarios | tabla o lista con más columnas |
| Detalle | pantalla completa | área principal; panel auxiliar solo cuando ayude |
| Formularios | una columna y secciones progresivas | una o dos columnas relacionadas |
| Acciones | principal cercana al pulgar; secundarias en menú textual | principal en encabezado; secundarias visibles |
| Ayuda | vista completa | panel lateral contextual |
| Filtros | resumen activo y hoja de filtros | barra de filtros persistente |

No se transforma una tabla ancha en desplazamiento horizontal como solución por
defecto. En móvil cada fila muestra identidad, estado y siguiente acción; el detalle
contiene el resto.

## Mapa por perfil

| Área | Empleado | Administrador |
| --- | --- | --- |
| Inicio | tareas y actividad propia | situación global y alertas accionables |
| Ventas | crear, editar borradores propios, cobrar y entregar propias | todas las ventas y operaciones administrativas |
| Inventario | consultar stock e historial sin costos | consultar, trasladar, ajustar, dar de baja y revisar |
| Clientes | buscar, registrar y actualizar datos básicos | lo anterior y fusionar duplicados |
| Catálogo | consulta desde Inventario/Ventas | administración completa |
| Compras | oculto | compras, proveedores y anticipos |
| Gastos | oculto | categorías, gastos y comprobantes |
| Reportes | oculto | caja, resultado, usuarios, productos y costos |
| Usuarios | oculto | administración de cuentas y sesiones |
| Carga inicial | oculto | disponible hasta confirmar la única carga |

## Búsqueda y acceso cruzado

- La búsqueda de producto aparece en Inventario y en la selección de líneas de
  venta; comparte resultados y lenguaje, no necesariamente el mismo contenedor.
- Desde un cliente se accede a sus ventas y desde una venta se accede a su cliente.
- Desde una alerta se abre el listado con filtros visibles y removibles.
- Un rastro de navegación solo se usa cuando existe jerarquía real; no se añade a
  pantallas principales de un solo nivel.

## Centro de ayuda

`Cómo funciona` ofrece ayuda del módulo actual. `Centro de ayuda`, dentro de Más,
reúne los mismos contenidos por tema y permite aprender sin iniciar una operación.
No se crea un segundo vocabulario ni documentación distinta: ambos consumen la
misma fuente de contenido cuando se implemente.
