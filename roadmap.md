# Roadmap

## P45 — Clientes nuevos y lista vacía
- [x] Añadir etiqueta de los últimos siete días e invitación sin búsqueda ni archivados, reutilizando los controles existentes.
- [x] Cambiar solo los dos avisos «Sin correo» de Caja y Staff a text-warn-texto.
- [x] Añadir P45 sin modificar P15/P20: 720 pruebas pasan; compilación OK. Clientes (lista llena/vacía con código 200/404) y ficha sin correo: 16 escenarios a 360/1280 px en claro/oscuro, axe sin fallas, sin desbordamientos ni errores con respuestas controladas; búsqueda por teclado y Enter comprobadas en Caja.
- [x] Guardar mediante commit para sincronización de Lovable.
- [ ] Confirmar GitHub: no hay remoto directo configurado; la subida no se puede verificar desde aquí.
- [ ] Verificar sesión real: /api/auth/refrescar responde 404; revisión privada realizada con respuestas controladas.
- Archivos: src/routes/clientes.tsx, src/components/caja/paso-ficha.tsx, src/components/staff/plan-negocio.tsx, src/test/p45.test.tsx y roadmap.md. esClienteNuevo, P15/P20, API, estilos, dependencias y service worker intactos.


## P44 — Clientes e invitación en Panel y pasos del registro
- [x] Añadir conteos e invitación exclusiva del dueño con enlace de registro; explicar tres pasos solo en el formulario público.
- [x] 690 pruebas pasan; compilación OK. 312 estados con respuestas controladas a 360/1280 px en Claro, Oscuro y los diez fondos personalizados: axe sin fallas, sin desbordamientos ni errores. Conteos, cero sin aviso, copia, destino de Compartir, navegación a Clientes, formulario, pendiente, cuenta existente, corregir, login con teléfono, unión con sesión y código ausente revisados. Caja, API, dependencias y worker sin cambios.
- [x] Revisión final ampliada: 504 estados en las mismas 24 combinaciones, axe sin fallas. Ambos enlaces nuevos, QR/cierre, cartel/impresión/regreso, archivados/filtro, solicitudes pendientes y acceso restringido del empleado comprobados. Corregido contraste del texto de solicitudes (4.43:1 antes), conservando fondo, orden y comportamiento; corregida ruta de configuración en el mock P44. Las 690 pruebas siguen pasando; capturas de Panel/Registro revisadas en cada apariencia.
- [x] Guardar cambios mediante commit para sincronización de Lovable.
- [ ] Confirmar GitHub: no hay remoto GitHub configurado; no se puede verificar la subida desde aquí.
- [ ] Verificar sesión real: /api/auth/refrescar responde 404; los recorridos autenticados se revisaron con respuestas controladas.
- Archivos: src/routes/panel.tsx, src/routes/registro.tsx, src/test/p44.test.tsx y roadmap.md.

## P42 — Registro pendiente, aprobación y enlaces
- [x] Actualizar contratos permitidos y registro público con cumpleaños, correo y consentimiento; retomar tras iniciar sesión.
- [x] Reusar el resultado de alta en Caja para aprobar solicitudes y confirmar su rechazo.
- [x] Copiar enlaces en QR/cartel, renovar código con confirmación sin cambiar impresión.
- [x] 673 pruebas pasan (38 nuevas P42); compilación OK. 171 estados a 360/770/1280 px en Claro/Oscuro/Personalizado con respuestas controladas, axe sin fallas ni desbordamientos/errores. Registro, cumpleaños inválido/29 febrero, corregir, 429, cuenta existente, login y retorno real por UI, cierre de sesión, aprobación 201/202/404, rechazo, foco y copia/fallo, renovación comprobados. PDF carta de una hoja sin controles en las tres apariencias; corregido contraste del campo QR contra la regla global oscura. Atajos existentes conservados y pruebas P15/P30 pasan.
- [x] Cambios preparados para commit y sincronización de Lovable. API solo en contratos permitidos; backend, dependencias y worker sin cambios. P38 conserva sus pruebas con mock parcial para la nueva función compartida.
- [x] Revisión adicional contra P42: 243 estados a 360/770/1280 px en las tres apariencias, axe sin fallas ni errores/desbordamientos. Destinos Recuperar con teléfono y Activar, aviso desactualizado, límite del negocio, nacimiento rechazado, baja del cliente, cancelación y 429 de renovación comprobados. Corregido el campo de enlace del cartel para estar visible y actualizarse junto con el QR; impresión sigue en una hoja sin controles. 674 pruebas pasan; sesión real y GitHub mantienen los bloqueos indicados.
- [ ] Verificar sesión del servicio real: /api/auth/refrescar responde 404; recorridos privados probados con respuestas controladas.
- [ ] Confirmar subida a GitHub: no hay remoto GitHub directo; sincronización depende de la integración de Lovable.
- Archivos: src/lib/api/registro.ts, src/lib/api/caja.ts, src/routes/registro.tsx, src/routes/__root.tsx, src/routes/caja.tsx, src/routes/negocio.cartel.tsx, src/components/retomar-registro.tsx, src/components/copiar-enlace.tsx, src/components/qr-registro.tsx, src/components/caja/paso-buscar.tsx, src/components/AGENTS.md, src/test/p36.test.tsx, src/test/p38.test.tsx, src/test/p42.test.tsx y roadmap.md.

## P41 — Logo derecho y prueba de activación
- [x] Ampliar solo el logo derecho con negocio a 56×56; conservar alto, respaldo y truncado.
- [x] Acotar dígitos P36 al teclado abierto con nombres exactos y límite propio de 60 s; actualizar expectativas P40 de tamaño.
- [x] 643 pruebas pasan; 24 estados de barra revisados a 360/1280 px en claro/oscuro/personalizado con respuestas controladas: logos 56×56, alto intacto de 73 px, solicitudes, nombre largo truncado, recarga, navegación a solicitudes y respaldo sin desbordamientos ni errores. Sesión real redirige a Login.
- [x] Cambios preparados para commit y sincronización de Lovable.
- [x] Auditoría ampliada contra el pedido: 120 estados a 360/1280 px, Claro/Oscuro y los diez fondos personalizados; ambos logos, solicitudes, recarga, navegación posterior y respaldo comprobados sin desbordamientos ni errores. Caja conserva A/C/R, Enter, Esc y ayuda en las 24 combinaciones. 643 pruebas vuelven a pasar; no se requieren cambios adicionales de aplicación.
- [ ] Confirmar sincronización GitHub: no hay remoto GitHub directo y el estado de integración solo está disponible en la interfaz de Lovable.
- Archivos: src/components/app-shell.tsx, src/test/p36.test.tsx, src/test/p40.test.tsx y roadmap.md.

## P40 — Fondos y marca superior
- [x] Paletas fijas, preferencia del dispositivo y selector compartido en Cuenta y Marca; restauración y marca superior sin cambiar API, dependencias ni worker.
- [x] 643 pruebas pasan; compilación OK; 94 estados revisados a 360/1280 px, diez fondos, Claro/Oscuro, restauración en ambas pantallas, recargas, nombre largo, logo fallido, sin negocio y dos solicitudes. Sin desbordamientos, errores de navegador ni hallazgos axe; guardar Marca conserva exactamente los campos anteriores y no envía fondo. Revisión privada con respuestas controladas: la sesión real redirige a Login.
- [x] Cambios preparados para guardar y sincronizar mediante Lovable; publicación solicitada para https://mi-saldo1.lovable.app.
- [ ] Confirmar publicación y sincronización GitHub: no existe scripts/publicar-frontend.sh ni remoto GitHub directo; la solicitud de publicación no confirma que terminó. Sesión real sin verificar porque Cuenta redirige a Login.
- Archivos: AGENTS.md, src/components/AGENTS.md, src/lib/fondos.ts, src/components/selector-fondo.tsx, src/components/misaldo-provider.tsx, src/components/app-shell.tsx, src/routes/ajustes.tsx, src/routes/negocio.marca.tsx, src/test/p40.test.tsx, src/test/p29.test.tsx, src/test/p34.test.tsx, src/test/p39.test.tsx, src/test/p6-correcciones.test.tsx y roadmap.md.
- Expectativas existentes actualizadas solo por P40: src/test/p29.test.tsx:105 (leyenda → logo); src/test/p34.test.tsx:67–70 (leyenda desde 400 px → By MicroFix Cloud desde 640 px); src/test/p39.test.tsx:77 y src/test/p6-correcciones.test.tsx:55,59 (preferencias incluyen fondo). Ninguna API, dependencia, service worker ni código de Caja cambió.
- [x] Auditoría final contra el pedido: 250 estados sin hallazgos axe, desbordamientos ni errores de navegador; 40 capturas revisadas de los diez fondos en Cuenta/Marca a 360/1280 px, dimensiones 56×56, palomita y colores exactos. Navegación desde Negocio a Marca, cancelación, recarga, Staff sin negocio, recuperación sin sesión y Caja en todos los fondos con A/C/R, Enter, Esc y ayuda comprobados. 643 pruebas vuelven a pasar; no hicieron falta cambios de aplicación. La página pública de Entrada responde, pero eso no confirma P40 en pantallas autenticadas ni sincronización GitHub.

## P39 — Entrada, secretos y apariencia
- [x] Ampliar Entrada y confirmaciones; compartir ojos para PIN y casillas solo en las pantallas solicitadas.
- [x] Restaurar colores desde Apariencia en todos los temas.
- [x] 627 pruebas pasan y compilación OK; 204 estados a 360/1280 px en claro/oscuro/personalizado, sin desbordamientos, errores de navegador ni hallazgos axe al medir tras las animaciones. Ojos, foco, submit, restauración y recarga revisados con respuestas controladas; auditoría adicional de Baja y Mis códigos realizada antes del bloqueo de la fixture de Staff.
- [x] Guardar cambios para sincronización de la plataforma. Expectativas de logo actualizadas solo en src/test/p23.test.tsx:61–67 (128 → 176 y size-32 → size-44).
- [ ] Verificación real y publicación: la sesión real redirige a Login; la revisión visual de Staff no pudo completarse con la fixture controlada. No hay remoto GitHub ni scripts/publicar-frontend.sh; subida directa y publicación no verificadas. Los enlaces de prueba necesitaron conservar el fragmento durante la doble ejecución de efectos de desarrollo; no se modificó ese comportamiento previo.
- Archivos: src/components/campo-pin.tsx, casillas-digitos.tsx, enlace-ui.tsx, completar-activacion.tsx, mis-negocios.tsx, cuenta/secciones.tsx, cuenta/mis-codigos.tsx, staff/precio-membresia.tsx, ui/alert-dialog.tsx; src/routes/login.tsx, ajustes.tsx, baja.tsx, eliminar-cuenta.tsx, recuperar.tsx, restablecer-pin.tsx, negocio.pin-pos.tsx, invitacion.tsx, validaciones.tsx; src/test/p39.test.tsx, p23.test.tsx; src/components/AGENTS.md y roadmap.md. API, dependencias, worker, Caja, registro.tsx y activar.tsx sin modificaciones.

## P38 — Cartel e instalación
- [x] Compartir enlace QR, cartel imprimible y acceso del dueño; invitación de instalación del cliente sin modificar worker, API ni dependencias.
- [x] Corregir vencimientos y etiqueta ámbar.
- [x] 602 pruebas pasan; 66 pantallas/estados auditados con axe sin fallas a 360/1280 px en claro/oscuro/personalizado, sin errores del navegador; Panel, QR, cartel, logo fallido, Clientes, vencimientos, rechazo/aceptación/cierre de instalación e instrucciones iPhone comprobados con respuestas controladas, recarga y navegación posterior. PDF de una sola hoja carta en los tres temas, QR de 12 cm y solo el cartel visible; ayuda de Caja intacta.
- [x] Guardar cambios en commit para sincronización de la plataforma.
- [ ] Subida directa/publicación bloqueadas: no hay remoto GitHub ni scripts/publicar-frontend.sh; sesión real redirige el cartel a Login. Instalación nativa no verificada: pruebas del evento y dispositivo son controladas.
- Compatibilidad: P30/P25/P36 intactas y código QR previamente exitoso conservado según P36b, incluso durante recargas/error; sin éxito previo usa bienvenida. Además de las tres expectativas anunciadas por P38, fue necesario actualizar solo el tono duplicado en P24c y «Venció 0 sellos en Café» en P37 a «Venció una tarjeta en Café» para satisfacer el nuevo texto; ninguna llamada de API ni dependencia modificada.
- [x] Auditoría ampliada contra P38: 96 estados en seis combinaciones con axe sin fallas; logo válido/fallido, nombre largo/sin nombre, configuración cargando, captura del evento antes de Inicio y appinstalled con recarga. Detectado y corregido que avisos invisibles aún ocupaban espacio al imprimir: ahora se eliminan del flujo y el PDF vuelve a una sola hoja carta incluso con un aviso externo de 4000 px. 603 pruebas pasan; compilación OK. Ajuste limitado a styles.css, p38.test.tsx y roadmap.md.

## P37 — Mensajes de vencimiento
- [x] Mostrar saldo vencido, tarjeta, sellos y avance remanente; ampliar solo los tipos de respuesta sin alterar llamadas, dependencias ni worker.
- [x] 578 pruebas pasan (17 nuevas P37), sin modificar pruebas existentes; compilación OK. Historial, Movimientos y detalle de Reclamaciones revisados a 360/1280 px en claro/oscuro/personalizado con respuestas controladas, filtros y cierre posterior; sellos a la derecha intactos y sin $0.00 por remanente ausente.
- [x] Guardar commit con los tipos, mensajes, pruebas y roadmap.
- [x] Revisión final contra el pedido: los cuatro vencimientos, singular con avance, tarjeta ausente y saldo con/sin monto comprobados también en Reclamaciones en las seis combinaciones; Movimientos conserva mensajes al recargar y Reclamaciones al cerrar/reabrir. 578 pruebas vuelven a pasar; no se requieren correcciones de la aplicación.
- [ ] Subida directa a GitHub no disponible sin remoto GitHub; sincronización de la plataforma y sesión real sin verificar.

## P36b — Recargas y legibilidad
- [x] Conservar preferencias y código QR ya cargados durante recargas y errores posteriores; ajustar tamaños y contraste sin cambiar contratos ni dependencias.
- [x] 561 pruebas pasan; recargas pendientes y errores posteriores revisados con respuestas controladas a 360/1280 px en claro/oscuro/personalizado, sin cambios del QR abierto ni pérdida de preferencias. Contraste axe sin hallazgos en 42 estados centrales y 90 adicionales; Caja conserva sus atajos. Sin activar conserva la diferencia de 2 px entre filas (más 1 px de separador si la comparación incluye la última fila). Revisión final: ambos botones de Mis datos y sus formularios en los seis tamaños/temas, corregidos sus íconos grises; QR sin éxito previo revisado en carga/404/200 en doce casos, con cierre y foco.
- [x] Cambios guardados en commit. Pruebas previas: P24b/P24c actualizadas solo en clases afectadas; P36 actualizada para conservar registro durante la recarga, reemplazando el comportamiento anterior incompatible con este pedido.
- [ ] Subida directa a GitHub bloqueada: no hay remoto GitHub configurado; sesión real sigue sin verificar, la revisión privada usa respuestas controladas.

## P36 — Auto-registro por QR
- [x] API nueva, activación compartida, página pública y QR con bienvenida como respaldo; contratos existentes, dependencias y worker intactos.
- [x] 552 pruebas pasan, las existentes intactas; registro y activación revisados a 360/1280 px en claro/oscuro/personalizado con respuestas controladas: solicitud exacta, consentimiento, 429, reenvío, código inválido, vencimiento, cuenta existente, login y formulario original. Revisión ampliada: carga, 404/500, nombre como texto plano, 409 en solicitud y activación, cambiar número conservando datos/promociones, OTP, cuenta ya activa, selector y reinicio de sesión; admin muestra 404 sin llamadas de registro y vuelve a Entrada; Caja conserva A/C/R, Enter, Esc y ayuda. QR revisado en carga/404/200, Esc, atrás y foco; corregido respaldo durante una recarga con código anterior en caché. Servicio real muestra Registro no disponible y elimina el fragmento.
- [ ] Activación real pendiente del servicio futuro; GitHub/publicación sin verificar: no hay remoto GitHub ni scripts/publicar-frontend.sh, se guarda commit para sincronización automática de la plataforma.

## P35 — Preferencias de notificaciones
- [x] GET/PUT nuevos y sección opcional únicamente con push activado; carga/errores de consulta ocultos y guardados fallidos revertidos.
- [x] 523 pruebas pasan (8 nuevas P35), sin modificar las existentes; Cuenta revisada a 360/1280 px en claro/oscuro/personalizado con respuestas controladas: ambos campos guardan y revierten, bloqueo de ambos interruptores, valores conservados tras recargar, carga y 404/500 sin sección ni avisos, ausencia de GET con push desactivado; filas contrastadas con Promociones, ubicación y textos comprobados; compilación OK y sin errores del navegador.
- [ ] Sesión real y sincronización con GitHub sin verificar: Cuenta real redirige a Login y los remotos disponibles no son GitHub; cambios guardados en commit para sincronización automática de la plataforma.

## P34 — Contraste, tamaños y barra superior
- [x] Ajustes de presentación y contraste de los temas, sin cambios de API ni funcionamiento.
- [x] 515 pruebas pasan; revisión a 360/1280 px en los tres temas: entrada, recuperación, 404, Inicio, Cuenta, Reportes y Equipo; medidas de toque y contraste con axe. Revisión ampliada: 90 pantallas/estados sin hallazgos medidos de contraste o ARIA, incluyendo todos los empleados y estados de Referidos, Staff y tarjetas; Caja A/C/R, Enter/Esc y ayuda, activación y privacidad un paso después. Corregidas opacidades heredadas y texto sobre superficies teñidas.
- [ ] Sesión real: /ajustes redirige a /login; la revisión privada usó respuestas simuladas.
- [ ] GitHub/publicación: no hay acceso directo verificable a GitHub ni scripts/publicar-frontend.sh; commit disponible para sincronización automática de la plataforma.

## P33 — Separación de Staff por sitio
- [x] Clasificación compartida de sitios y filtros de perfiles, sin cambiar contratos de API.
- [x] Guarda de sesión, rutas ocultas con la 404 existente y etiqueta de entrada admin.
- [x] 490 pruebas pasan sin modificar las existentes; compilación OK. Revisión ampliada: 162 recorridos simulados a 360/1280 px en claro, oscuro y personalizado; perfiles, ausencia de perfiles, Cuenta, todas las rutas indicadas, cierre único, recuperación de PIN y navegación posterior comprobados sin errores del navegador.
- [ ] Verificación con sesión real: /ajustes redirige a /login; requiere acceso autenticado a la API existente.

## P31 — Intentos y recomendaciones en Cuenta
- [x] Mensajes compartidos de intentos con puntuación conservada.
- [x] Inicio y Cuenta comparten regla y consulta de recomendaciones.
- [x] 423 pruebas pasan; Login, PIN POS, Inicio y Cuenta verificados con respuestas simuladas a 360/1280 px, en claro/oscuro/personalizado, incluyendo carga, error y destinos de enlaces.
- [ ] Cuenta con sesión real: /ajustes redirige a /login; requiere acceso autenticado a la API existente.

## QR de registro y bienvenida pública
- [x] Enlace con nombre limpio en fragmento y página pública sin llamadas propias a la API.
- [x] QR en Buscar cliente y Panel; cierre, foco, historial y bloqueo de teclas sin perder el teléfono.
- [x] 406 pruebas pasan y compilación OK; bienvenida a 360 px y QR en claro/oscuro, Esc, atrás, foco y teléfono comprobados con sesión simulada.
- [ ] Recorrido de Caja con sesión real: /caja redirige a /login; requiere acceso autenticado a la API existente.

## P29 — Claridad y actualización del cliente y Caja
- [x] PIN POS y activación: etiquetas, confirmación y errores.
- [x] Caja: legibilidad, premios, scroll, foco y teclado decimal compartido.
- [x] Barra: solicitudes pendientes y logo del negocio por contexto.
- [x] Cliente: actualización visible cada 20 s, historial y reclamaciones.
- [x] Tarjetas: leyendas renovables, candado inicial y comprobante.
- [x] P29: 16 pruebas nuevas; 379 pruebas pasan y compilación OK. Caja verificada a 360/1280 px con respuestas simuladas, sin compras.
- [ ] Verificación con sesión real: /caja redirige a /login; requiere acceso autenticado de la API existente.

## P25b — Íconos de la app con el logo de Mi Saldo Vip (completo)
- [x] Guardadas las 2 imágenes adjuntas (512×512, sin modificar) en public/icons/mi-saldo-vip-512.png y mi-saldo-vip-maskable-512.png; borrados icon-512.png, favicon.png y favicon.ico del logo verde.
- [x] Manifest con los 2 íconos nuevos (purpose any y maskable); __root.tsx enlaza icon y apple-touch-icon nuevos; vista previa de Promociones usa el ícono nuevo; sin referencias al logo viejo en src/ ni public/.
- [x] Pruebas p25b añadidas: 334 pruebas en verde y compilación OK, sin tocar package.json ni service worker. Pendiente: cambiar el ícono de notificaciones en infra/pwa/sw.js (lado del servidor) y publicar.

## P25 — Notificaciones push y Promociones del dueño (completo)
- [x] API push (llave pública, suscripciones, resumen/historial/envío de promociones) y lógica del dispositivo con APIs del navegador; sin service worker propio ni librerías de push.
- [x] Cerrar sesión desactiva la suscripción del dispositivo (antes de logout, con límite de 3 s, sin bloquear la salida).
- [x] Bloque "Notificaciones" en Cuenta (cliente) según estado del dispositivo; nota fija de cierre de sesión.
- [x] Ruta /negocio/promociones: resumen, formulario con vista previa, confirmación con código TOTP (CasillasDigitos + NumericKeypad) e historial con sondeo mientras envía; tarjeta nueva en Mi negocio.
- [x] Mensajes de error limite/sin_destinatarios/totp_no_activado y pruebas p25: 330 pruebas en verde y compilación OK, sin tocar package.json. Pendiente: recorrido real (el backend de vista previa no responde /api/auth/refrescar).

## P24d — Detalles visuales de P24c (completo)
- [x] Token --esqueleto (#E2E8F0 claro / #334155 oscuro) y Skeleton con bg-esqueleto visible sobre tarjetas blancas.
- [x] Filas de Clientes en 2 renglones fijos: nombre truncado arriba; teléfono, «Sin activar», «Archivado» y fecha compactos abajo.
- [x] Tarjetas-enlace de Mi negocio y Panel con transition-[color,background-color,border-color,box-shadow,transform] duration-150; sin transition-colors + transition-transform juntas en src/.
- [x] Pruebas P24d añadidas: 305 pruebas en verde y compilación OK. Sin cambios de lógica, rutas, API, textos ni package.json.

## P24c — Aspecto de listas, títulos, íconos, cargas y vacíos (completo)
- [x] secondary-foreground legible, separador y warning-icono en ambos modos; anillo de casilla reforzado en oscuro y «Sí, cerrar caja» en variante primario.
- [x] Títulos h1 en negrita, filas con Iniciales y separador tras el círculo en Clientes/Empleados, IconoTono por grupo en Mi negocio y Panel, Cargando con esqueletos y EstadoVacio en listas vacías.
- [x] Pruebas P24c añadidas: 299 pruebas en verde y compilación OK; acceso revisado en vista previa. Sin cambios de lógica, API ni package.json.

## P24b — Teclado, casillas y botones desactivados (completo)
- [x] Aplicar tokens y aspecto de teclas sin cambiar entrada ni envío.
- [x] Compartir casillas entre PinPos y CampoDigitos, conservando límites y etiquetas.
- [x] Neutralizar solo botones default desactivados; 290 pruebas pasan y compilación OK. Revisión a 1280/400 px en claro/oscuro con sesión y API simuladas: puntos, siguiente casilla, borrar/limpiar y habilitación con seis dígitos; sin operaciones reales.

## P24a — Superficies elevadas (completo)
- [x] Sustituir neumorfismo por bordes finos y sombras verticales por modo; invertir fondo/tarjetas claros y reforzar campos sin cambiar la paleta restante.
- [x] Unificar sombras de elementos flotantes y barras; conservar el anillo de Caja mediante outline y actualizar la regla de AGENTS.md.
- [x] Pruebas P24a añadidas: 280 pruebas en verde y compilación OK. Entrada, campos y confirmación revisados en ambos modos a 1280/400 px; Caja y anillo verificados en Modo Diseño, no con una sesión real.

## P24 — Paleta oficial estricta (completo)
- [x] `--barra` #232E21 en ambos modos; primario #1E293B claro / #10B981 oscuro; turquesa #0F766E/#0b7a5e eliminado de src/ y public/.
- [x] "Ir a la caja" del Panel pasa a `btn-accion` naranja; WhatsApp vuelve al verde oficial #25D366; theme-color y manifest actualizados.
- [x] Tema personalizado vuelve a ajustar la letra con `readableForeground`; 270 pruebas en verde y compilación OK.

## P24 — Paleta Azul Cobalto + Coral + Amarillo (completo)
- [x] `:root`/`.dark`: primary #2563EB/#3B82F6, accent Coral #F43F5E, nuevas `--warning`/`--warning-foreground` (#EAB308/#FCD34D), chart-4 = warning, chart-5 ajustado; comentario del archivo actualizado.
- [x] Retirados #232E21/#F97316/#10B981 como primary: theme-color, manifest, PRESETS de Ajustes y DEFAULT_PRIMARY → #2563EB; #25D366 de WhatsApp intacto.
- [x] Resaltado de menús UI (dropdown, select, command, context-menu, menubar, navigation-menu, toggle, calendar) → `bg-secondary text-foreground`; Coral solo en botones de acción.
- [x] Sellos ganados y premios en `bg-warning`/`text-warning`; franja de la tarjeta de saldo `bg-accent/25` → `bg-white/5`.
- [x] Pruebas P23 actualizadas + nuevas (paleta, restos hex, btn-accion, menús, sellos, WhatsApp): 274 en verde, build OK, entrada verificada en claro y oscuro.

## P23 — Ajuste de paleta y tamaños de marca (completo)
- [x] Valores claro/oscuro, colores fijos y Canjear principal ajustados; personalización solo sobrescribe primary.
- [x] Caja inferior naranja y logos de encabezado/Entrada/Cuenta a 48/128/96 px, conservando respaldos.
- [x] 264 pruebas en verde; compilación OK; Entrada real y Cuenta con datos simulados revisadas a 1280/400/770 px, sin desbordamiento. La sesión real sigue bloqueada por 404 en /api/auth/refrescar.

## P22 — Marca "Mi Saldo Vip", paleta y navegación (completo)
- [x] Logos: PNG en Navbar (sin sesión/Staff), SVG circular en Login y avatar de perfil
- [x] Nombre visible "Mi Saldo Vip" (titles, og:title, manifest, textos) + componente `MarcaMiSaldo`
- [x] Paleta nueva en `src/styles.css` (claro/oscuro, `--success-fill`, `--barra`, `--barra-foreground`, charts, sombras neo claro)
- [x] `btn-accion` naranja en la variante `default` de Button; `btn-premium` solo navegación
- [x] AppBar: fondo `bg-barra`, subtítulo con MarcaMiSaldo, iniciales y botones en blanco
- [x] Menú inferior: Caja destacada al centro (dueño y empleado); `roleHome` con mapa fijo
- [x] `/negocio` en 3 secciones + reglas del asistente
- [x] Colores fijos (amber/emerald/red) → tokens `warn`/`success`/`success-fill`/`destructive`
- [x] Pruebas: p8 actualizada + nueva `src/test/p22.test.tsx` (253 pruebas en verde, build OK, revisión visual en claro y oscuro)

Pendiente fuera de alcance: publicar y verificar con sesiones reales (el backend de vista previa no responde `/api/auth/refrescar`).

## P32 — Bienvenida sin doble decodificación
- [x] `limpiarNombreNegocio` ya no decodifica: solo limpia controles/dirección, junta espacios, recorta y corta a 150
- [x] Pruebas p30 actualizadas: literales con `%`, ida y vuelta con `URLSearchParams`, botón QR con "Café 100% natural" y página con fragmento codificado (429 pruebas en verde, build OK)

## P43 · Compartir, QR desde Caja y login con teléfono
- [x] Compartir, botón de Caja, número grande, login con teléfono, prueba P20 más rápida, P43 (683 pruebas).

## Claude · Correcciones del comité al pre-registro por QR (2026-11-20, sin Lovable, opción C)
- [x] QR-A5: en Caja, Enter ya no aprueba una solicitud del QR; el botón dice "Aprobar a {nombre}" y pide confirmar que es la persona que está enfrente (`paso-buscar.tsx`).
- [x] QR-A8: el teléfono entre registro, login y "Olvidé mi PIN" viaja en `sessionStorage` (`src/lib/telefono-prellenado.ts`) y no en la URL; `/login` y `/recuperar` ya no leen `?telefono=`.
- [x] QR-A12: el encabezado del registro consulta `POST /api/registro/negocio` con el código en el cuerpo (antes `GET /api/registro/negocio/{codigo}`).
- [x] Pruebas: p36, p42, p43 y p44 actualizadas solo en lo que cambió; `claude-telefono-prellenado.test.ts` nueva.
- [x] H3 (comité, 2026-11-20): cerrar sesión da de baja las notificaciones de este navegador (servidor y `PushManager`) antes de `/auth/logout`; si falla, el cierre sigue (`src/lib/api/auth.ts`, `claude-logout-push.test.ts`).

## Claude · Beneficio de cumpleaños, primeras pantallas (2026-11-20, backend 0061)
- [x] Caja: franja "Cumpleaños de {nombre}" en la ficha con "Entregar beneficio de cumpleaños" (confirmación), "Ya recibió… (cajero)" y "Anular: no se entregó" solo para el dueño el mismo día (`components/caja/franja-cumpleanos.tsx`).
- [x] Promociones: sección "Beneficio de cumpleaños" (activar, qué le das, cuándo vale) en `/negocio/promociones` (`components/negocio/beneficio-cumpleanos.tsx`), sin ruta nueva.
- [x] API `src/lib/api/cumpleanos.ts`; prueba `claude-cumpleanos.test.tsx`.
- [ ] Pendiente: "Cambiar cumpleaños" en la ficha del cliente para el dueño, Excel conectado, notificación de cumpleaños.
- [x] Ficha del cliente (dueño, `/clientes`): "Cumpleaños: …" y "Cambiar cumpleaños" (día y mes, solo este negocio). El botón **solo aparece si el backend responde `cambio_disponible: true`**: hoy está apagado hasta que exista el aviso al cliente (`components/negocio/cumpleanos-cliente.tsx`).

## Claude · Errores de la Caja con explicación (2026-11-21, prueba de campo, opción C)
- [x] `avisarError` (`components/caja/caja-contexto.tsx`): si el mensaje no cabe en el título (más de 26 caracteres), el título queda "No se pudo completar" y el texto completo va en la descripción (antes se perdía). Se conservan las pistas de intentos y "Disponible".
- [x] `sin_configuracion` en Caja: título "Falta configurar" y "El dueño debe configurarlo en Negocio antes de usarlo en la Caja." (en la prueba, Nevería sin monedero configurado solo decía "No se pudo completar").
- [x] Prueba `claude-caja-errores.test.ts` (3 de 4 fallan con el código anterior).

## P46 · Tus PINes
- [ ] Tarjeta de cliente con consulta al tocar, confirmación y cambio del PIN de canje.
- [ ] Borrar secretos a los 30 segundos, al ocultar la pestaña, salir o cambiar de negocio.
- [ ] Unificar nombres de PIN sin cambiar lógica ni campos de API.
- [ ] Pruebas P46, regresiones y revisión visual/accesibilidad.
- [ ] Commit; comprobar disponibilidad de sincronización con GitHub.
