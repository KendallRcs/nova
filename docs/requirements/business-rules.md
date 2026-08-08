# Reglas de negocio transversales

> Estado: Fase 2 confirmada. Estas reglas prevalecen sobre resúmenes o ejemplos.


1. Existe una tienda y un almacén; el stock se controla por ubicación.
2. El código manual de producto es único y cada variante comercial se registra como producto diferente.
3. Una venta contiene múltiples productos y múltiples unidades por producto.
4. La reserva no reduce existencia física; reduce disponibilidad.
5. La entrega sí reduce existencia física en la ubicación seleccionada.
6. Una línea puede entregarse o reservarse parcialmente.
7. Las ventas con saldo requieren un cliente identificado por nombre y teléfono.
8. El teléfono normalizado pertenece a un solo cliente.
9. El vencimiento es informativo: marca atraso, pero no cancela ni aplica recargos automáticamente.
10. Un empleado registra pagos solo en ventas propias; un administrador puede hacerlo en cualquiera.
11. El creador de la venta y el registrador de cada pago se conservan por separado.
12. Solo un administrador aprueba precios inferiores al mínimo, devoluciones, bajas, ajustes y traslados.
13. Toda devolución exige razón y reembolso; el retorno físico puede o no ocurrir.
14. Las compras se pagan al contado en el MVP y pueden usar proveedores registrados u ocasionales.
15. Un nuevo costo de compra solo sugiere revisar precios; nunca los cambia automáticamente.
16. Las compras, anticipos, gastos, reembolsos y cobros son movimientos de caja diferenciados.
17. La compra de inventario no es gasto operativo; se convierte en costo cuando se vende o en pérdida cuando se da de baja.
18. Los gastos recurrentes se registran manualmente cada mes.
19. Las operaciones confirmadas se anulan o compensan conservando motivo, actor y fecha.
20. `created_at` y `updated_at` no sustituyen el historial de eventos sensibles.
21. Un anticipo puede aplicarse parcialmente a varias compras del mismo proveedor.
22. Una compra puede utilizar uno o varios anticipos del mismo proveedor.
23. Un anticipo puede reembolsarse total o parcialmente y siempre conserva un saldo explicable.
24. Todo producto pertenece a una categoría.
25. El código, nombre, categoría y precio mínimo son obligatorios.
26. La descripción, etiquetas, precio sugerido y precio máximo son opcionales.
27. Un producto puede tener como máximo dos imágenes opcionales.
28. El inventario se controla únicamente en unidades enteras.
29. La primera carga por Excel incluye costo inicial y cantidades físicas separadas para tienda y almacén.
30. La carga inicial genera movimientos de apertura de inventario, no compras ni egresos de caja.
31. La importación inicial es atómica: si una fila es inválida, no se registra ninguna.
32. La importación por Excel es una herramienta de inicialización de un solo uso y no forma parte de la operación habitual.
33. Cada colaborador utiliza una cuenta individual con nombre de usuario y contraseña.
34. La sesión permanece disponible hasta que el usuario cierre sesión, la cuenta sea desactivada o un administrador revoque el acceso.
35. Desactivar una cuenta revoca todas sus sesiones activas y conserva su historial.
36. El administrador solo asigna contraseñas temporales; no conoce la contraseña personal definitiva del colaborador.
37. Restablecer una contraseña revoca las sesiones anteriores y exige cambiar la credencial temporal en el siguiente acceso.
38. La contraseña tiene al menos diez caracteres, puede ser una frase y no puede coincidir con el nombre de usuario.
39. Las contraseñas no expiran periódicamente.
40. Los intentos fallidos no bloquean la cuenta; la API deberá limitar la frecuencia de solicitudes de autenticación sin exigir desbloqueo administrativo.
41. Solo el administrador gestiona categorías y etiquetas.
42. Las categorías y etiquetas utilizadas se desactivan en lugar de eliminarse.
43. Los precios presentes deben mantener el orden mínimo, sugerido y máximo; los dos últimos continúan siendo opcionales.
44. Una venta en borrador es editable y no produce movimientos financieros ni de inventario.
45. Los productos, cantidades y precios de una venta confirmada no se sobrescriben directamente.
46. Solo el administrador puede ajustar el total acordado de una venta confirmada y debe indicar una razón.
47. Un pago no puede superar el saldo vigente; si cambia el acuerdo, primero se registra un ajuste del total.
48. Una devolución puede realizarse en cualquier momento y no posee cancelación automática por antigüedad.
49. Un reembolso no puede superar el importe neto pagado y aún no reembolsado por las unidades devueltas.
50. El método del reembolso se registra según la salida real de dinero y puede diferir del pago original.
51. En el MVP, los conteos posteriores se resuelven por producto mediante ajustes auditables; no existe una jornada masiva de inventario.

