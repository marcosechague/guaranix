# 0006 — Plataforma: superadmin, planes de GuaraniX y "entrar como"

Fecha: 2026-11-28 · Estado: propuesta

## Contexto

La Fase 0 pide alta y baja de centros, planes de GuaraniX, suspender y reactivar, "entrar como" un box con auditoría, y métricas (MRR, boxes activos y en prueba). Todo eso cruza boxes, así que no puede correr dentro de `withBoxScope`.

## Decisiones

- **Router propio.** Las rutas `/platform/*` se arman con `createPlatformRouter()`, que exige `users.is_platform_admin` y corre el pedido en una transacción sin aislamiento (`withSystemScope`) que se deshace ante cualquier error. Es el único archivo de la API que usa `withSystemScope` fuera del login; está en `SYSTEM_SCOPE_FILES`.
- **Auditoría en el historial del box.** Cada cambio de la plataforma se registra con el `box_id` afectado (`box.created`, `box.suspended`, `box.impersonation_started`…), así el box también lo ve. Los cambios de planes de GuaraniX quedan con `box_id` nulo.
- **Planes como datos.** `platform_plans` guarda precio mensual, precio por sede adicional y un cupo opcional de boxes (`box_limit`): el precio fundador tiene cupo 20. Al asignar un plan lleno la API responde `platform_plan_full`. El superadmin los edita sin deploy.
- **MRR** = suma de lo que paga cada box **activo**: precio del plan + sedes adicionales (`boxes.extra_locations`) por el precio de sede. Los boxes en prueba se muestran aparte como MRR potencial. Los suspendidos y dados de baja no suman.
- **Suspender bloquea el box.** Con el box `suspended` o `cancelled`, `createBoxRouter()` responde `403 box_suspended` o `box_cancelled` a todo su staff y alumnos. La sesión sigue listando la membresía con `boxStatus`, para que las apps expliquen por qué. Suspender y dar de baja piden un motivo (`status_reason`). Reactivar vuelve a `trial` si la prueba no venció, si no a `active`.
- **Dar de baja es lógico.** El box queda `cancelled` con todos sus datos; no se borra nada (auditoría, facturas futuras, y se puede reactivar).
- **"Entrar como" (solo lectura).** Pide un motivo (queda en el historial del box, porque soporte ve datos personales de los alumnos). La sesión del admin guarda `impersonated_box_id` y `impersonation_ends_at` (una hora). Mientras dura, `createBoxRouter()` lo deja **ver** el box como `box_owner` aunque no esté en su staff, pero rechaza todo pedido que no sea `GET` con `403 impersonation_read_only`: soporte no registra pagos, no cambia precios ni planes, no borra ni edita nada. El bloqueo está en el middleware (también en `createBoxRouterWithoutTransaction()`), así una ruta nueva queda cubierta sin acordarse. Si soporte necesita arreglar algo, lo hace el dueño o se hace desde `/platform`, que audita cada cambio. Solo vale si la cuenta sigue siendo platform admin, no venció y el box no fue dado de baja (a un box suspendido sí se puede entrar, para mirarlo). Una impersonación que deja de valer se borra de la sesión en el momento, y cerrar la sesión también la borra. `GET /auth/session` devuelve `impersonation` (con `readOnly: true`) para que el panel del box muestre un aviso de solo lectura con "Salir".
- **Alta desde la plataforma.** Crea el box en prueba de 30 días, busca al dueño por email o le crea la cuenta sin contraseña (entra con Google o "Olvidé mi contraseña"), y carga la plantilla paraguaya. El slug sale del nombre ("Ñu Guasú Training" → `nu-guasu-training`) y, si está tomado, suma `-2`, `-3`…

## Pendiente

- Auditar también las lecturas de datos sensibles mientras se "entra como" (hoy solo quedan la entrada y la salida).
- Costo de infraestructura en las métricas: hoy no hay de dónde leerlo; falta una carga manual mensual o leerlo de Cloudflare y Neon.
- Cobro de GuaraniX a los boxes (Fase 1) y paso automático de `trial` a `active` o `suspended` al vencer la prueba (Cron Trigger).
- Precio congelado por box (hoy el MRR usa el precio actual del plan; el fundador "de por vida" depende de no tocar ese plan).
