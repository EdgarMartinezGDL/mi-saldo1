# P21 · Membresía con Stripe y domiciliado

- Obtener los métodos del servidor y mostrarlos en su orden, con su nombre y disponibilidad; conservar Transferencia y OXXO y mostrar Mercado Pago deshabilitado cuando llegue como Próximamente.
- Adaptar el formulario de pago único para enviar el proveedor, conservando meses, total, llave de reintento y regreso. La tarjeta se captura únicamente en Stripe.
- Agregar el domiciliado: oferta, continuación, estado activo y tarjeta enmascarada, próximo cargo, cobros, cancelación y reanudación con la confirmación 2FA existente.
- Crear la pantalla de regreso de Stripe con confirmación inicial, consulta periódica limitada y estados indicados; mostrar modo de prueba también en el pago único.
- Agregar pruebas P21 y ajustar únicamente las simulaciones de P12/P13 afectadas. Ejecutar todas las pruebas y verificar los recorridos en Chromium, escritorio y 400×860.
- No modificar backend, dependencias, diseño ni otras secciones. Los recorridos reales dependen de que la API externa y sus sesiones estén disponibles.

## Detalles técnicos
- Usar exactamente los contratos y endpoints del documento en `pagos.ts`, sin configurar otra integración Stripe.
- Compartir `membresia-metodos` y `membresia-suscripcion` mediante React Query; conservar invalidaciones y las llaves de creación ante reintentos.
- Reutilizar `useConTotp`, `Dialog`, `Alerta`, `AvisoPagoPrueba` y los formatos existentes.
- P20 permanece aplicado y verificado; su publicación anterior fue interrumpida y no se ejecutó.