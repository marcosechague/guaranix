# 0004 — Servicios de la API

Fecha: 2026-11-27 · Estado: propuesta

## Contexto

La API de la Fase 0 necesita mucha lógica de negocio (planes, créditos, reservas, cobros) y `CLAUDE.md` pide que las rutas solo validen, autoricen y llamen servicios. El login se construye en paralelo.

## Decisiones

- **Servicios como funciones** en `apps/api/src/services`, que reciben un `ServiceContext`: la transacción ya abierta con `withBoxScope` (así RLS siempre aplica), el actor (`userId`, `boxId`, `role`) y `now`, para que los tests controlen el reloj. No conocen Hono.
- **Doble control de permisos.** Las rutas declaran los roles permitidos; los servicios igual revisan el rol y, para alumnos, que el dato sea suyo. Si un alumno pide el perfil de otro, la respuesta es la misma que si no existiera (`member_not_found`), para no revelar ids.
- **Errores con código estable** (`ServiceError`: `member_plan_overlap`, `pause_outside_plan`…). El frontend traduce el código con `es-PY.json`; la API no devuelve textos.
- **Vender un plan abre un cargo** por el precio congelado (con descuento si recepción lo puso). Si el precio es 0 no hay cargo. Así la lista de deudores sale sola de `charges`.
- **No se superponen planes activos** de un mismo alumno. La renovación empieza el día siguiente al vencimiento.
- **Las pausas no cambian el estado guardado.** Se guardan como rangos de fechas, corren el vencimiento la misma cantidad de días, y el estado del día (`active`, `paused`, `upcoming`, `expired`) se calcula con `memberPlanStateOn`. No hace falta un cron para empezar o terminar una pausa. Solo se puede quitar una pausa que todavía no empezó.
- **Fechas del box.** "Hoy" es la fecha en la zona horaria del box (`boxes.timezone`), con los helpers de `packages/shared/src/dates`.
- **Tests de servicios con PGlite** y dos boxes sembrados (A y B), con un usuario por rol. Cada servicio prueba roles, aislamiento entre boxes y las reglas de dinero y créditos.
