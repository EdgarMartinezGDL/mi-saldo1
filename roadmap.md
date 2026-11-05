# Roadmap

## P24a — Superficies elevadas
- [ ] Sustituir neumorfismo por bordes finos y sombras verticales por modo; invertir fondo/tarjetas claros y reforzar campos sin cambiar la paleta restante.
- [ ] Unificar sombras de elementos flotantes y barras; conservar el anillo de Caja y actualizar la regla de AGENTS.md.
- [ ] Añadir pruebas P24a, ejecutar todas las pruebas y revisar superficies en claro/oscuro y móvil/escritorio.

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
