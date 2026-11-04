# Roadmap

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
