# P20 · Notificaciones de Staff

- Actualizar únicamente los contratos de Notificaciones y agregar las dos llamadas de reintento y cadena indicadas.
- Incorporar entrega, filtro, contadores, motivos, confirmación con auditoría y cadena de reintentos en la pestaña existente, preservando su diseño y textos ajenos a P20.
- Mantener toda autorización de reintento en las respuestas del servidor; no agregar 2FA, backend ni dependencias.
- Ajustar P11 sin quitar pruebas y agregar P20 con los casos del documento; ejecutar la suite completa.
- Verificar en Chromium los reintentos, errores, cadena y filtros en escritorio y a 400×860; distinguir simulación de acceso real.
- Publicar mediante el procedimiento disponible. El script solicitado no existe en este proyecto; no se creará ni se cambiará el backend.

## Detalles técnicos
- Reutilizar `ConfirmarMotivo`, `NOTA_AUDITORIA`, `errorStaff` y las llamadas centralizadas de `staff.ts`.
- Vaciar cadenas al recargar sin cursor y conservar filtros aplicados al refrescar tras éxito o error.
- Registrar el patrón de Notificaciones en `AGENTS.md` y el resultado de las comprobaciones en la hoja de tareas.