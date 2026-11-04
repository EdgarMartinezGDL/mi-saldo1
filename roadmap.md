# Roadmap

## P22 — Marca "Mi Saldo Vip", paleta y navegación (en curso)
- [ ] Logos: PNG rectangular en Navbar, SVG circular en Login y avatar de perfil
- [ ] Nombre visible "Mi Saldo Vip" (titles, og:title, manifest, textos) + componente `MarcaMiSaldo`
- [ ] Paleta nueva en `src/styles.css` (claro/oscuro, tokens `--success-fill`, `--barra`, `--barra-foreground`, charts, sombras neo claro)
- [ ] `btn-accion` naranja; variante `default` de Button la usa; `btn-premium` solo navegación
- [ ] AppBar: fondo `bg-barra`, subtítulo con MarcaMiSaldo, iniciales y botones en blanco
- [ ] Menú inferior: Caja destacada al centro (dueño y empleado); `roleHome` con mapa fijo
- [ ] `/negocio` en 3 secciones (Operación, Marketing y recompensas, Administración) + reglas del asistente
- [ ] Revisión de colores fijos (teal/emerald/amber/orange/hex) → tokens
- [ ] Pruebas: actualizar las que buscan "MiSaldo" + nueva `src/test/p22.test.tsx`
- [ ] Verificar: vitest + build + revisión visual
