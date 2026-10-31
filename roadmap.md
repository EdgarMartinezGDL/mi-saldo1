# P21
- [ ] Métodos enviados por el servidor, pago único Stripe y domiciliado con cancelación/reanudación; solo frontend
- [ ] Regreso /membresia/domiciliado y aviso de prueba del pago único
- [ ] Pruebas P21 y ajustes mínimos P12/P13; suite completa y Chromium a 400×860 y escritorio
- [ ] Recorrido real con dueños y Stripe: requiere API externa y sesiones válidas

# P20
- [x] Tipos y llamadas de reintento/cadena; entrega, filtros, resumen y confirmación en Notificaciones, solo frontend
- [x] 228 pruebas pasan; compilación correcta; Chromium simulado a 1280×1800 y 400×860 verifica reintento, cadena y filtros sin desbordamiento ni errores
- [ ] Publicación interrumpida por nuevo documento; scripts/publicar-frontend.sh no existe
- [ ] Recorrido real con Teo y Sofía: /api/auth/refrescar devuelve 404 y redirige a login; requiere API externa y sesiones válidas

# P19
- [x] Ficha del negocio, franja de Inicio y contacto en Datos y marca, solo frontend
- [x] 215 pruebas pasan (23 de P19), compilación correcta; Chromium simulado a 1280×1800 y 400×860 verifica guardado, validación, Inicio → ficha, enlaces, vacío y reintento sin errores
- [ ] Recorrido real con Carla y Diego: POST /api/auth/refrescar devuelve 404 y redirige a login; requiere API externa y sesiones válidas

# P16d
- [x] Cambiar únicamente el texto del selector a Archivados y los dos textos indicados de la prueba
- [x] Las 11 pruebas P16 pasan y compilación correcta
- [ ] Recorrido real con Carla: requiere API externa y sesión válida (bloqueo de P16c)

# P16c
- [x] Sustituir el interruptor por selector y filtro exclusivo en URL, solo en Clientes
- [x] Las 11 pruebas P16 pasan y compilación correcta; navegador con respuestas simuladas a 1280×1800 y 400×860 verifica filtros, recarga, búsqueda y tres controles iguales de 44 px sin desbordamiento
- [ ] Recorrido real con Carla: Clientes redirige a login; requiere API externa y sesión válida

# P16b
- [x] Cambiar solo el rango inicial de Inactivos y las tres comprobaciones de su prueba
- [x] Las 10 pruebas P16 pasan; compilación correcta
- [ ] Recorrido con Carla en Barbería Demo y Excel real: bloqueado porque POST /api/auth/refrescar devuelve 404; requiere API externa y sesión válida

# P16
- [x] Tipos, formato de fecha y filtros de Clientes; ficha archivada
- [x] Tarjeta del Panel y filtros/rango de Reportes
- [x] 191 pruebas pasan (10 de P16), compilación correcta; navegador simulado a 1280×1800 y 400×860 verifica Panel → solo archivados → Ver todos → búsqueda → ficha → reportes, sin desbordamiento ni errores
- [ ] Recorrido con Carla y Barbería Demo: bloqueado porque POST /api/auth/refrescar devuelve 404 en la vista previa; requiere API externa y sesión válida

# P15b
- [x] Restaurar botones nativos e íconos con clases anteriores y anillo de foco en los cuatro controles indicados; conservar compacto, pistas y data-caja-opcion
- [x] Enter en casilla del aviso; teclado físico sin mouse; confirmación enfoca siempre; foco automático sin desplazar título
- [x] 181 pruebas pasan (6 nuevas en P15); compilación correcta; navegador con respuestas simuladas a 1366×768 y 400×860: búsqueda, alta con Espacio/Enter una vez, atajo A sin mouse, ícono de acción a 32 px y título completo sin errores
- [ ] Recorrido con cuenta real: bloqueado porque POST /api/auth/refrescar devuelve 404 en la vista previa; requiere API externa y sesión válida

# P15
- [x] Teclado físico, foco y confirmaciones protegidas en Caja; Enter repetido y primeros 400 ms bloqueados
- [x] Dos columnas desde 1024 px, resumen y ayuda de atajos; móvil sin pistas ni foco automático y teclado del tamaño original
- [x] 175 pruebas pasan (15 nuevas de P15); compilación correcta; recorrido simulado 1366×768 con PIN, búsqueda, acumulación, canje/código, reclamación, alta con Tab, comprobante y ayuda; táctil 400×860 sin desbordamiento ni errores
- [ ] Recorrido real con Emilio/Barbería Demo y verificación de movimientos reales: bloqueado porque POST /api/auth/refrescar devuelve 404 en la vista previa; requiere API externa y sesión válida

# P14b
- [x] Horarios sin guardar: "Guardar horarios" habilitado con la propuesta tal cual; con horarios guardados sigue pidiendo un cambio
- [x] Tarjeta "Configuración inicial": texto gris "Termina de configurar tu negocio para empezar a cobrar." y alerta "Te falta 1 paso obligatorio." / "Te faltan {n} pasos obligatorios." una sola vez
- [x] 160 pruebas pasan (6 nuevas de P14b) y compilación correcta
- [ ] Recorrido real con negocio sin horarios, Barbería Demo y Farmacia Demo: bloqueado porque GET /api/negocio/asistente y POST /api/auth/refrescar devuelven 404 en la vista previa; requiere la API externa y sus sesiones.

# P14
- [x] API y consulta compartida del asistente, lista y cierre
- [x] Barra condicional en los seis pasos e invalidación tras todos sus guardados
- [x] Entrada desde Panel y pendientes en Panel/Mi negocio
- [x] 154 pruebas pasan; recorrido simulado con horarios, cashback, tarjeta, PIN POS, omisiones, cierre, posponer, retroceso al desactivar tarjeta y pantallas completas/sin barra; escritorio y celular sin errores
- [ ] Recorrido real con negocio nuevo, Farmacia Demo y Barbería Demo: bloqueado porque GET /api/negocio/asistente y POST /api/auth/refrescar devuelven 404 en la vista previa; requiere acceso a la API externa y sus sesiones.

# P8 celular

- [x] Tagline "By MicroFix Cloud"
- [x] Desplazamiento al abrir secciones
- [x] Teclado no tapa campos
- [x] Modo lectura/Editar en formularios guardados
- [x] plural() sin "(s)"
- [x] Contador de dígitos en CampoDigitos
- [x] Botón "Ir a mi inicio"
- [x] Pruebas

# P9 correo

- [x] Correo obligatorio y normalizado en alta de Caja
- [x] Aviso de correo anterior conservado
- [x] Correo sin confirmar y confirmación en Cuenta
- [x] Pruebas de P9 y comprobación disponible (18 pruebas pasan)
- [ ] Recorrido P9 con API real: bloqueado por falta de sesión autenticada; Caja y Cuenta redirigen a Entrar.

# P10
- [x] Caja: horarios y revisión cada 60 segundos
- [x] Copia de cliente y pantalla sin conexión; registro protegido del worker existente (skill PWA)
- [x] Staff: autorización y página pública de restablecimiento de PIN
- [x] Pruebas y comprobación disponible: 53 pruebas; página pública y fallo de red simulado sin errores en navegador
- [ ] Apertura sin internet en sitio publicado: bloqueada porque https://my-saldo.lovable.app/sw.js devuelve 404; se necesita el worker del servidor y un dominio de producción permitido.
- [ ] Recorrido P10 con cuentas reales (empleado/dueño/cliente/Staff) y enlace WhatsApp: bloqueado por falta de sesiones válidas de la API externa.

# P11
- [x] Correo en ficha de Caja y guardado mediante ejecutar con interrupciones POS
- [x] Notificaciones de Staff, filtros, resumen y paginación
- [x] Fechas compartidas y corrección de doble punto; sin otros puntos después de horas formateadas
- [x] 69 pruebas pasan; Caja y Notificaciones de soporte comprobadas visualmente con respuestas simuladas, sin errores
- [ ] Recorrido con cuentas reales de Caja y Staff y aviso MailHog: bloqueado porque /api/auth/refrescar devuelve 404 en la vista previa y no hay sesión válida de la API externa.

# P12
- [x] Aviso público desde API y aceptación versionada en los tres formularios
- [x] Aceptación pendiente para todos los roles dentro de AppShell
- [x] Pago en línea, simulador, regreso e historial; conservar transferencia y depósito
- [x] 95 pruebas pasan; aviso, aceptación, tarjeta rechazada/reintento/aprobación y OXXO ficha/pagar después/aprobación comprobados con respuestas simuladas, sin errores en navegador
- [ ] Aviso y recorrido con cuentas reales: bloqueados porque GET /api/aviso-privacidad y POST /api/auth/refrescar devuelven 404 en la vista previa; requiere conexión con la API externa ya preparada.

# P13
- [x] P13b: envío con valores reales, validación explícita y foco; 43 pruebas pasan y compilación correcta. Recorrido real sigue bloqueado por API externa (ver P13).
- [x] API de precio y tarjeta en Negocios con historial para ambos niveles
- [x] Diálogo exclusivo admin, validaciones y confirmación autenticador/PIN
- [x] Etiquetas de auditoría; pago en línea oculto si la pasarela no está disponible
- [x] 126 pruebas pasan, incluyendo límites, factor único, errores, limpieza de secretos y precio remoto del dueño; compilación correcta
- [x] Comprobación simulada en navegador: fijar $299 con autenticador, cambiar $349 con PIN, historial, 422 y 401 al login; soporte sin botón, sin errores de ejecución
- [ ] Recorrido real con Sofía, Teo y dueño: bloqueado porque GET /api/staff/membresia/precio y POST /api/auth/refrescar devuelven 404 en la vista previa; requiere la API externa conectada.
