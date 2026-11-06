# Roadmap

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
