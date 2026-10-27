/** Spanish messages per backend `codigo`. Codes not listed fall back to the backend's own message. */
const MENSAJES: Record<string, string> = {
  sin_conexion: "No se registró: revisa tu conexión.",
  respuesta_invalida: "El servidor no respondió correctamente. Intenta de nuevo.",
  sesion_expirada: "Tu sesión terminó. Vuelve a entrar.",
  // Autenticación
  sin_accesos: "Tu cuenta no tiene accesos activos. Pide ayuda al negocio.",
  contexto_no_disponible: "Ese acceso ya no está disponible. Vuelve a entrar.",
  token_invalido: "El tiempo para este paso terminó. Vuelve a entrar.",
  codigo_incorrecto: "El código de tu app no es correcto.",
  factor_invalido: "Escribe el código de tu app o uno de respaldo (solo uno).",
  requiere_enrolamiento_totp: "Primero registra tu app autenticadora.",
  sin_totp: "Necesitas activar la verificación en dos pasos para continuar.",
  requiere_totp_reciente: "Confirma con el código de tu app autenticadora.",
  sin_permiso: "Ya no tienes permiso para esta acción. Vuelve a entrar.",
  // Caja
  sin_caja: "Este perfil no tiene caja.",
  pin_pos_requerido: "La caja está cerrada. Escribe el PIN POS para abrirla.",
  pin_pos_incorrecto: "PIN POS incorrecto.",
  pin_pos_no_configurado: "El dueño aún no define el PIN POS.",
  membresia_vencida: "La caja está bloqueada hasta que el negocio registre su pago.",
  cliente_no_encontrado: "Ese teléfono no es cliente de este negocio.",
  autoacumulacion: "No puedes darte sellos a ti mismo: que te atienda otro cajero.",
  autocanje: "No puedes canjear tu propia cuenta: que te atienda otro cajero.",
  modulo_inactivo: "Este negocio no tiene activada esa función.",
  modulo_en_retiro: "Este negocio ya no da sellos nuevos; solo se canjean los que ya tienen los clientes.",
  sin_configuracion: "El dueño aún no termina de configurar esta tarjeta.",
  idempotency_conflicto: "Hubo un problema con la operación. Vuelve a intentarlo.",
  idempotency_key_invalida: "Hubo un problema con la operación. Vuelve a intentarlo.",
  monto_invalido: "El monto no es válido.",
  monto_requerido: "Escribe el monto de la compra.",
  cantidad_invalida: "La cantidad de sellos debe ser de 1 a 100.",
  cantidad_no_aplica_por_monto: "Esta tarjeta da sellos por monto: escribe el total de la compra.",
  tarjeta_no_encontrada: "Esa tarjeta ya no está disponible. Busca al cliente otra vez.",
  codigo_requerido: "Pide al cliente su código de 4 dígitos.",
  codigo_invalido: "El código del cliente no es correcto.",
  // Canjes
  saldo_insuficiente: "El cliente no tiene saldo suficiente.",
  sin_codigo: "El cliente aún no ha definido su código de canje en la app.",
  bloqueado: "El código de canje del cliente está bloqueado temporalmente.",
  bloqueado_alerta: "Código bloqueado 24 h por muchos intentos. Le avisamos al cliente.",
  requiere_cambio: "El cliente debe cambiar su código de canje desde su app.",
  sin_tarjeta_completa: "El cliente no tiene premios de esta tarjeta por canjear.",
  tarjeta_vencida: "El premio de esta tarjeta ya venció.",
  totp_cancelado: "Acción cancelada: falta confirmar con tu app autenticadora.",
  // Cliente
  solo_cliente: "Esta pantalla es solo para clientes.",
  pin_incorrecto: "PIN incorrecto.",
  modulo_invalido: "Filtro no válido.",
  cursor_invalido: "No se pudo cargar más. Recarga la pantalla.",
  // Dueño
  solo_dueno: "Esta función es solo para el dueño.",
  fecha_futura: "Esa fecha todavía no llega.",
  rango_invalido: "La fecha inicial es posterior a la final.",
  rango_excedido: "El periodo no puede pasar de 92 días.",
  busqueda_invalida: "Escribe al menos 4 dígitos o 2 letras.",
  ya_es_empleado: "Esa persona ya es empleado del negocio.",
  es_el_dueno: "Ese teléfono es el tuyo, el del dueño.",
  telefono_invalido: "El teléfono no es válido.",
  no_encontrado: "No se encontró. Recarga la lista.",
  cuenta_activada: "Ya activó su cuenta; no necesita otra invitación.",
  ya_dado_de_baja: "Ya estaba dado de baja.",
  factor_invalido_monedero: "El porcentaje de cashback no es válido.",
  vigencia_invalida: "La vigencia debe ser de 1 mes a 10 años.",
  pin_pos_trivial: "El PIN POS no puede ser una secuencia ni un número repetido.",
  nombre_invalido: "Revisa el nombre.",
  // Staff
  solo_staff: "Esta función es solo para Staff MiSaldo.",
  ya_suspendido: "El negocio ya estaba suspendido.",
  no_suspendido: "El negocio no está suspendido.",
  motivo_invalido: "Escribe un motivo de 5 a 500 caracteres.",
  no_encontrada: "No se encontró esa persona.",
  sin_cambio: "Los datos ya eran esos.",
  propio: "Tus propios datos los corrige otro administrador.",
  persona_eliminada: "Esa persona se dio de baja: ya no tiene datos.",
  nacimiento_incompleto: "Escribe día y mes de nacimiento, o ninguno.",
  nacimiento_invalido: "Esa fecha de nacimiento no existe.",
  nombre_requerido: "El nombre no puede quedar vacío.",
  texto_invalido: "Revisa los textos que escribiste.",
  cambios_invalidos: "No hay cambios válidos para guardar.",
  // Enlaces de WhatsApp
  enlace_invalido: "El enlace no es válido, venció o ya se usó. Pide al negocio que te lo reenvíe.",
  pin_debil: "Elige un PIN menos predecible.",
  codigo_trivial: "Ese código es muy fácil de adivinar.",
  ya_activada: "Tu cuenta ya está activa.",
  codigo_agotado: "Usaste todos los intentos de este código. Pide uno nuevo.",
  sesion_cerrada: "Por seguridad cerramos tu sesión. Vuelve a entrar.",
};

export function mensajeDeError(
  status: number,
  codigo: string | undefined,
  message: unknown,
  retryAfter?: number,
) {
  if (status === 429) {
    const min = retryAfter ? Math.max(1, Math.ceil(retryAfter / 60)) : null;
    return min ? `Demasiados intentos. Intenta de nuevo en ${min} min.` : "Demasiados intentos. Espera un momento.";
  }
  if (codigo && MENSAJES[codigo]) return MENSAJES[codigo];
  if (status === 401) return "Teléfono o PIN incorrectos.";
  if (status === 400 && Array.isArray(message)) return "Revisa los datos del formulario";
  if (typeof message === "string" && message && message !== codigo) return message;
  return "Algo salió mal. Intenta de nuevo.";
}
