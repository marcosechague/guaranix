# API del box

Rutas de la API para el panel del box y la app del alumno. Todas necesitan sesión (cookie) y corren en el box activo de la sesión; las escrituras necesitan `Origin` permitido y `X-CSRF-Token` (ver `docs/decisions/0003-login-y-sesiones.md`). Las reglas de negocio están en `docs/decisions/0004-servicios-de-la-api.md`.

- Montos en guaraníes enteros (`amountGs`, `priceGs`), cargas en gramos (`loadGrams`), fechas del calendario como `YYYY-MM-DD` en la hora del box, instantes en ISO 8601.
- Los cuerpos y consultas se validan con los esquemas de `packages/shared/src/schemas`.
- Errores: `{ "error": "<código>" }`. `400 invalid_input`, `403 forbidden`, `404 <entidad>_not_found`, `409` conflicto, `422` regla de negocio. Cada código tiene su texto en `es-PY.json` bajo `errors`.

Roles: **staff** = dueño, admin, coach, recepción · **recepción** = dueño, admin, recepción · **gestión** = dueño, admin · **coaching** = dueño, admin, coach.

| Ruta                                                                                                              | Quién                               | Para qué                                                                |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `GET /box/current`                                                                                                | todos                               | Box activo y rol                                                        |
| `GET /box/settings/booking` · `PATCH`                                                                             | staff / gestión                     | Política de reservas del box (se manda completa)                        |
| `GET /box/members?search&status&limit&offset`                                                                     | staff                               | Buscar alumnos                                                          |
| `GET /box/members/count`                                                                                          | staff                               | Cantidad de alumnos                                                     |
| `POST /box/members` · `PATCH /box/members/:id`                                                                    | recepción                           | Alta y edición                                                          |
| `GET /box/members/:id` · `/plans` · `/records`                                                                    | staff                               | Ficha, planes con estado del día y PRs                                  |
| `POST /box/members/:id/plans`                                                                                     | recepción                           | Vender un plan (abre el cargo)                                          |
| `GET /box/plans`                                                                                                  | todos                               | Planes (alumnos ven solo los activos)                                   |
| `POST /box/plans` · `PATCH /box/plans/:id`                                                                        | gestión                             | Crear y editar (se manda el plan completo)                              |
| `POST /box/member-plans/:id/pauses` · `DELETE /box/member-plans/pauses/:id` · `POST /box/member-plans/:id/cancel` | recepción                           | Pausas y baja de un plan                                                |
| `GET /box/programs` · `POST` · `PATCH /:id`                                                                       | todos / gestión                     | Programas                                                               |
| `GET /box/schedules` · `POST` · `PATCH /:id` · `POST /:id/end`                                                    | staff / gestión                     | Horarios semanales; el PATCH cambia cupo/coach de las clases que vienen |
| `POST /box/classes/generate`                                                                                      | gestión                             | Generar clases de un rango                                              |
| `GET /box/classes?from&to`                                                                                        | todos                               | Clases con cupos, lista de espera y tu reserva                          |
| `GET /box/classes/:id/roster` · `POST /:id/attendance`                                                            | staff                               | Lista y asistencia                                                      |
| `PATCH /box/classes/:id` · `POST /:id/cancel`                                                                     | gestión                             | Cupo, coach, suspender                                                  |
| `POST /box/bookings` · `POST /box/bookings/:id/cancel`                                                            | todos                               | Reservar (`{ classId }`) y cancelar                                     |
| `GET /box/movements` · `POST`                                                                                     | todos / coaching                    | Movimientos                                                             |
| `GET /box/workouts?date&programId` · `GET /:id`                                                                   | todos                               | WOD del día (alumnos: solo publicados)                                  |
| `POST /box/workouts` · `PATCH /:id` · `POST /:id/publish` · `/unpublish` · `DELETE /:id`                          | coaching                            | Programar WODs                                                          |
| `POST /box/results` · `DELETE /box/results/:id` · `POST /:id/fist-bump`                                           | todos / alumno                      | Resultados y fist bumps                                                 |
| `GET /box/components/:id/leaderboard`                                                                             | todos                               | Pizarra del día                                                         |
| `GET /box/charges?memberId&status` · `POST` · `POST /:id/void`                                                    | recepción / gestión                 | Cargos                                                                  |
| `GET /box/payments?status&memberId&from&to` · `POST /:id/review`                                                  | recepción                           | Pagos y revisión de comprobantes                                        |
| `POST /box/payments`                                                                                              | recepción, o alumno con comprobante | Registrar o informar un pago                                            |
| `GET /box/reports/debtors`                                                                                        | recepción                           | Deudores                                                                |
| `GET /box/reports/dashboard?from&to`                                                                              | gestión                             | Cobrado, pendiente, deuda, alumnos, ocupación                           |
| `GET /box/me` · `/plans` · `/bookings` · `/records` · `/account`                                                  | alumno                              | Perfil, planes, reservas, PRs y cuota                                   |

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
| `POST /platform/boxes/:id/impersonate`         | "Entrar como" el box durante una hora                                   |
| `POST /platform/impersonation/end`             | Salir del box                                                           |
