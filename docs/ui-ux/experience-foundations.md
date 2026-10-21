# Fundamentos de experiencia

**Estado:** dirección confirmada el 2026-10-20.

## Trabajo que debe resolver la interfaz

Nova es una herramienta de operación, no una página promocional. Una persona debe
poder atender una venta o consulta de stock con pocas decisiones, mientras el
administrador conserva acceso a operaciones densas y sensibles sin convertir la
experiencia móvil en un panel contable.

La interfaz se diseña para dos escenas reales:

- teléfono Android en el mostrador, almacén o transmisión, normalmente con una mano
  y con interrupciones;
- laptop o PC para revisar información, mantener el catálogo, registrar compras y
  gastos o analizar el negocio.

## Principios

### 1. La acción frecuente aparece primero

`Nueva venta`, `Buscar producto`, `Registrar pago` y las tareas pendientes no deben
quedar detrás de dashboards decorativos. Los indicadores resumen; nunca desplazan
la operación principal.

### 2. Un concepto conserva siempre el mismo nombre

La navegación, el título, el botón y el mensaje posterior utilizan el lenguaje de
las historias: venta, pago, reserva, entrega, traslado, baja, ajuste, compra, anticipo
y gasto. La interfaz no introduce sinónimos creativos ni nombres técnicos del API.

### 3. Mostrar primero lo necesario y explicar lo demás

Los formularios presentan primero las decisiones habituales. Costos, razones,
versiones, excepciones o consecuencias aparecen cuando el actor y el estado los
requieren. La divulgación progresiva no oculta información irreversible.

### 4. Todo estado sensible debe ser explicable

Ventas, cuentas de clientes e inventario muestran un rastro cronológico legible:
qué ocurrió, cuándo, quién lo registró y qué cambió. Esta es la firma funcional de
`Mostrador luminoso`; no se usa como decoración fuera de la trazabilidad.

### 5. Permisos coherentes en interfaz y servidor

La interfaz evita ofrecer acciones que el perfil no puede ejecutar, pero nunca
reemplaza la autorización del backend. Costos y márgenes no se renderizan ni se
solicitan en vistas de empleado.

## Dirección visual: Mostrador luminoso

La superficie recuerda una mesa de trabajo limpia: áreas claras, etiquetas directas,
acciones visibles y estados acotados. No utiliza una estética infantil, contabilidad
pesada, consola oscura, cristal, neón ni color por módulo.

| Token conceptual | Color | Uso permitido |
| --- | --- | --- |
| Nube | `#F6F8FC` | fondo general y separación de zonas |
| Superficie | `#FFFFFF` | formularios, listas y áreas de trabajo |
| Tinta | `#1F2937` | texto principal, iconos y contraste |
| Azul Nova | `#2563EB` | acción primaria, foco y selección actual |
| Menta | `#2BAE8C` | éxito, disponibilidad y confirmación |
| Ámbar | `#F3B43F` | atención, vencimiento y revisión necesaria |
| Rojo | `#D94A4A` | error y acción destructiva exclusivamente |

Reglas de color:

- Nube y Superficie ocupan la mayor parte de cada pantalla.
- Azul Nova identifica una acción principal por contexto; varias acciones azules
  compitiendo indican una jerarquía incorrecta.
- Menta, Ámbar y Rojo acompañan texto o iconografía y nunca comunican solos.
- Los fondos semánticos usan tintes claros; los tonos plenos quedan para controles,
  indicadores pequeños y foco.
- El contraste se verificará para texto, controles, foco y estados deshabilitados.

La lámina de referencia vive en
[nova-color-palette.svg](assets/nova-color-palette.svg).

## Tipografía y números

La familia definitiva se seleccionará al resolver la arquitectura frontend. Debe
ser una sans de alta legibilidad en Android, Windows y navegadores modernos, con
caracteres inequívocos y soporte correcto de español. La interfaz evita display
fonts en controles.

Dinero, cantidades, códigos, fechas y horas usan cifras tabulares cuando la familia
lo permita. El tamaño tipográfico es estable por breakpoint; no se usa tipografía
fluida en formularios o tablas.

## Ayuda integrada

Cada módulo incluye una acción secundaria estable llamada `Cómo funciona`. Abre:

1. propósito del módulo;
2. acciones disponibles según perfil;
3. secuencia habitual;
4. efectos sobre inventario, dinero o deuda;
5. estados y excepciones frecuentes;
6. enlaces contextuales a tareas relacionadas.

En móvil la explicación usa una vista completa con retorno claro; en escritorio
puede ocupar un panel lateral sin tapar el contexto. Los campos complejos admiten
ayuda breve junto a la etiqueta. La ayuda nunca aparece como modal obligatorio al
entrar ni depende de recorridos animados.

## Contenido y retroalimentación

- Botones con verbo y objeto: `Registrar pago`, `Confirmar venta`, `Dar de baja`.
- Confirmaciones con el mismo verbo: `Pago registrado`, no `Operación exitosa`.
- Errores explican qué ocurrió y cómo corregirlo, sin códigos técnicos como mensaje
  principal.
- Una pantalla vacía explica qué aparecerá allí y ofrece la acción adecuada cuando
  el perfil puede ejecutarla.
- Las confirmaciones destructivas nombran el objeto y la consecuencia real.

## Accesibilidad e interacción

- ancho mínimo de referencia: 320 píxeles;
- objetivos táctiles de al menos 44 por 44 píxeles;
- navegación completa por teclado y foco siempre visible;
- orden de foco equivalente al orden visual;
- encabezados y regiones semánticas consistentes;
- errores asociados al campo y resumen al inicio cuando existan varios;
- estados no dependientes únicamente de color;
- movimiento de 150 a 250 ms para explicar cambios de estado, nunca para decorar;
- `prefers-reduced-motion` elimina desplazamientos no indispensables.

## Antipatrones explícitos

- dashboard compuesto solo por tarjetas métricas;
- navegación mediante iconos sin texto;
- menús distintos para el mismo concepto entre móvil y escritorio;
- formularios extensos dentro de modales;
- acción destructiva junto a la acción principal;
- tablas de escritorio comprimidas horizontalmente en móvil;
- mensajes genéricos como `Algo salió mal` sin una recuperación posible;
- tutoriales que bloquean el trabajo o ayudas que repiten la etiqueta sin explicar.
