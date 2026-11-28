# API del box

Rutas de la API para el panel del box y la app del alumno. Todas necesitan sesión (cookie) y corren en el box activo de la sesión; las escrituras necesitan `Origin` permitido y `X-CSRF-Token` (ver `docs/decisions/0003-login-y-sesiones.md`). Las reglas de negocio están en `docs/decisions/0004-servicios-de-la-api.md`.

- Montos en guaraníes enteros (`amountGs`, `priceGs`), cargas en gramos (`loadGrams`), fechas del calendario como `YYYY-MM-DD` en la hora del box, instantes en ISO 8601.
- Los cuerpos y consultas se validan con los esquemas de `packages/shared/src/schemas`.
- Errores: `{ "error": "<código>" }`. `400 invalid_input`, `403 forbidden`, `404 <entidad>_not_found`, `409` conflicto, `422` regla de negocio. Cada código tiene su texto en `es-PY.json` bajo `errors`.

Roles: **staff** = dueño, admin, coach, recepción · **recepción** = dueño, admin, recepción · **gestión** = dueño, admin · **coaching** = dueño, admin, coach.

| Ruta                                                                                                              | Quién                               | Para qué                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /box/current`                                                                                                | todos                               | Box activo, rol y modos de asistencia activos                                              |
| `GET /box/settings/booking` · `PATCH`                                                                             | staff / gestión                     | Política de reservas del box (se manda completa)                                           |
| `GET /box/settings/check-in` · `PATCH`                                                                            | staff / gestión                     | Modos de asistencia (entrada, coach, QR de pared) y radio                                  |
| `GET /box/members?search&status&limit&offset`                                                                     | staff                               | Buscar alumnos                                                                             |
| `GET /box/members/count`                                                                                          | staff                               | Cantidad de alumnos                                                                        |
| `POST /box/members` · `PATCH /box/members/:id`                                                                    | recepción                           | Alta y edición                                                                             |
| `GET /box/members/:id` · `/plans` · `/records`                                                                    | staff                               | Ficha, planes con estado del día y PRs                                                     |
| `POST /box/members/:id/plans`                                                                                     | recepción                           | Vender un plan (abre el cargo)                                                             |
| `GET /box/plans`                                                                                                  | todos                               | Planes (alumnos ven solo los activos)                                                      |
| `POST /box/plans` · `PATCH /box/plans/:id`                                                                        | gestión                             | Crear y editar (se manda el plan completo)                                                 |
| `POST /box/member-plans/:id/pauses` · `DELETE /box/member-plans/pauses/:id` · `POST /box/member-plans/:id/cancel` | recepción                           | Pausas y baja de un plan                                                                   |
| `GET /box/programs` · `POST` · `PATCH /:id`                                                                       | todos / gestión                     | Programas                                                                                  |
| `GET /box/schedules` · `POST` · `PATCH /:id` · `POST /:id/end`                                                    | staff / gestión                     | Horarios semanales; el PATCH cambia cupo/coach de las clases que vienen                    |
| `POST /box/classes/generate`                                                                                      | gestión                             | Generar clases de un rango                                                                 |
| `GET /box/classes?from&to`                                                                                        | todos                               | Clases con cupos, lista de espera y tu reserva                                             |
| `GET /box/classes/:id/roster` · `POST /:id/attendance`                                                            | staff                               | Lista y asistencia                                                                         |
| `PATCH /box/classes/:id` · `POST /:id/cancel`                                                                     | gestión                             | Cupo, coach, suspender                                                                     |
| `POST /box/bookings` · `POST /box/bookings/:id/cancel`                                                            | todos                               | Reservar (`{ classId }`) y cancelar                                                        |
| `POST /box/check-ins`                                                                                             | staff                               | Check-in con el QR del alumno (`{ pass }`); ver `decisions/0014`                           |
| `GET /box/movements` · `POST`                                                                                     | todos / coaching                    | Movimientos                                                                                |
| `GET /box/workouts?date&programId` · `GET /:id`                                                                   | todos                               | WOD del día (alumnos: solo publicados)                                                     |
| `POST /box/workouts` · `PATCH /:id` · `POST /:id/publish` · `/unpublish` · `DELETE /:id`                          | coaching                            | Programar WODs                                                                             |
| `POST /box/results` · `DELETE /box/results/:id` · `POST /:id/fist-bump`                                           | todos / alumno                      | Resultados y fist bumps                                                                    |
| `GET /box/components/:id/leaderboard`                                                                             | todos                               | Pizarra del día                                                                            |
| `GET /box/charges?memberId&status` · `POST` · `POST /:id/void`                                                    | recepción / gestión                 | Cargos                                                                                     |
| `GET /box/payments?status&memberId&from&to` · `POST /:id/review`                                                  | recepción                           | Pagos y revisión de comprobantes                                                           |
| `POST /box/payments`                                                                                              | recepción, o alumno con comprobante | Registrar o informar un pago                                                               |
| `GET /box/reports/debtors`                                                                                        | recepción                           | Deudores                                                                                   |
| `GET /box/reports/dashboard?from&to`                                                                              | gestión                             | Cobrado, pendiente, deuda, alumnos, ocupación                                              |
| `POST /box/imports/preview`                                                                                       | gestión                             | Vista previa de una importación, fila por fila                                             |
| `POST /box/imports` · `GET /box/imports` · `GET /:id`                                                             | gestión                             | Importar alumnos, planes y saldos; historial                                               |
| `GET /box/imports/ai-status` · `POST /box/ai-imports/extract`                                                     | gestión                             | Usos de IA del mes; leer una foto, PDF o planilla con IA y proponer filas (no guarda nada) |
| `GET /box/card-payments/settings` · `PATCH /account`                                                              | gestión                             | Cuenta del procesador (nunca la clave privada), prender o apagar el débito automático      |
| `PUT /box/card-payments/account` · `DELETE`                                                                       | dueño                               | Conectar o cambiar claves (se prueban y se guardan cifradas); desconectar                  |
| `GET /box/card-payments/attempts` · `POST /links`                                                                 | recepción                           | Intentos de cobro; link de pago de un cargo con mensaje para WhatsApp                      |
| `GET /box/card-payments/members/:id/cards`                                                                        | recepción                           | Tarjeta activa del alumno (marca y últimos 4)                                              |
| `POST /box/card-payments/payments/:id/refund`                                                                     | gestión                             | Anular un pago con tarjeta del mismo día                                                   |
| `GET /box/card-payments/me/cards` · `POST` · `POST /:id/confirm` · `DELETE /:id`                                  | alumno                              | Su tarjeta: guardar (con `acceptAutopay`), confirmar al volver del formulario, quitar      |
| `GET /box/me` · `/plans` · `/bookings` · `/records` · `/account`                                                  | alumno                              | Perfil, planes, reservas, PRs y cuota                                                      |
| `GET /box/me/check-in-pass`                                                                                       | alumno                              | QR para entrar al box (dura 2 minutos)                                                     |

## API de la plataforma

Rutas del superadmin (`apps/platform`). Solo para cuentas con `users.is_platform_admin`; cualquier otro rol de un box recibe `403 forbidden`. Corren sin aislamiento por box (ven todos los centros) y cada cambio queda en `audit_logs`, con el `box_id` del box afectado para que también aparezca en su historial. Ver `docs/decisions/0006-plataforma-superadmin.md`.

| Ruta                                           | Para qué                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /platform/metrics`                        | MRR, MRR potencial de los boxes en prueba, boxes por estado, alumnos    |
| `GET /platform/plans` · `POST` · `PATCH /:id`  | Planes de GuaraniX (precio, sede adicional, cupo de boxes)              |
| `GET /platform/boxes?status&search` · `POST`   | Listar y dar de alta boxes (con dueño y plantilla)                      |
| `GET /platform/boxes/:id` · `PATCH /:id`       | Ficha con actividad reciente; cambiar plan, sedes extra o fin de prueba |
| `POST /platform/boxes/:id/suspend` · `/remove` | Suspender o dar de baja (`{ reason }`, lo ve el staff del box)          |
| `POST /platform/boxes/:id/reactivate`          | Reactivar                                                               |
| `POST /platform/boxes/:id/impersonate`         | "Entrar como" el box durante una hora, solo lectura                     |
| `POST /platform/impersonation/end`             | Salir del box                                                           |
| `GET /platform/ai` · `PATCH`                   | Proveedor y modelo de IA; qué claves hay cargadas (solo su final)       |
| `PUT /platform/ai/keys/:provider` · `DELETE`   | Cargar (se guarda cifrada) o quitar la clave de un proveedor            |
| `POST /platform/ai/test`                       | Pedido mínimo al proveedor configurado para probar clave y modelo       |
| `GET /platform/plans/:id/features`             | Funciones que incluye un plan (`ai_import`, `whatsapp`) y su límite     |
| `PUT /platform/plans/:id/features/:feature`    | `{ enabled, monthlyLimit }`; `null` = sin límite                        |
| `GET /platform/boxes/:id/features`             | Lo que da su plan, la excepción del box, lo efectivo y los usos del mes |
| `PUT /platform/boxes/:id/features/:feature`    | Excepción para el box; `null` en los dos campos vuelve a su plan        |

## Alta del box

`POST /onboarding/box` (con sesión, sin box). Cuerpo: `boxSignupSchema` (nombre, ciudad, teléfono, rubro, `setup` con programas, horarios y planes, `bookingOpensHoursBefore`, `acceptWarnings`). Responde `201` con el box, el plan de GuaraniX y el fin de la prueba; `422 setup_invalid` o `setup_needs_confirmation` con `issues`; `429 rate_limited` después de 3 altas en el día. Ver `docs/decisions/0007-alta-del-box-y-plantillas.md`.

## Notificaciones

Ajustes de cada persona, fuera del box (siguen a la persona en todos sus boxes). Con sesión; ver `docs/notificaciones.md`.

| Ruta                                            | Para qué                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /notifications/settings`                   | Preferencias por tema y canal, si hay push (clave VAPID) y Telegram        |
| `PUT /notifications/preferences`                | `{ topic, channel, enabled }`; solo combinaciones que existen              |
| `POST /notifications/push-subscriptions`        | Guarda la suscripción push de este navegador (`PushSubscription.toJSON()`) |
| `POST /notifications/push-subscriptions/remove` | `{ endpoint }`: la saca                                                    |
| `POST /notifications/telegram/link` · `DELETE`  | Enlace `t.me/<bot>?start=<código>` de un solo uso (15 min) · desvincular   |
| `POST /integrations/telegram/webhook`           | Lo llama Telegram, con `X-Telegram-Bot-Api-Secret-Token`; sin sesión       |

## Pagos con tarjeta (públicas)

Sin sesión. Ver `docs/decisions/0012-pagos-con-tarjeta-bancard.md`.

| Ruta                                 | Para qué                                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `POST /webhooks/payments/:accountId` | Confirmación del procesador; verifica firma, registra y es idempotente |
| `GET /pay/:token`                    | Datos del link de pago (box, nombre, concepto, monto, estado)          |
| `POST /pay/:token/checkout`          | Abre el formulario de pago del procesador                              |
| `POST /pay/:token/simulate`          | Solo con el mock y fuera de producción: simula la respuesta            |
