# 0009 — Tarea programada que genera las clases

## Contexto

Los horarios (`class_schedules`) son la plantilla semanal y las clases (`classes`) son lo que el alumno reserva. Hasta ahora las clases se generaban a mano (`POST /box/classes/generate`) o en el alta del box, así que un box dejaba de tener clases a las dos semanas.

## Decisiones

- **Cron diario de Cloudflare** (`triggers.crons` en `apps/api/wrangler.jsonc`, `0 6 * * *`: 03:00 en Asunción). Entra por `scheduled` en `apps/api/src/index.ts` → `runScheduledJobs` (`src/scheduled.ts`).
- **Ventana de 14 días** (`UPCOMING_CLASS_DAYS`), contados desde el "hoy" de cada box en su zona horaria. Es la misma que usa el alta.
- **Solo boxes en prueba o activos.** Los suspendidos y dados de baja no reciben clases nuevas. Si se reactiva uno, la próxima corrida lo pone al día.
- **Idempotente:** si la clase de ese horario y esa hora ya existe, no se toca, aunque esté editada, cancelada o con reservas. Los cambios de cupo o de coach de un horario ya llegan a las clases futuras por `updateSchedule`; el cron usa el valor actual para los días nuevos.
- **Aislamiento:** el cron lista los boxes con `withSystemScope` (`src/jobs/upcoming-classes.ts`, en `SYSTEM_SCOPE_FILES`) y genera cada box dentro de su propio `withBoxScope`, con RLS. Si un box falla, los demás siguen. La corrida termina en error para que Cloudflare la marque como fallida. El log lleva solo ids y conteos.
- La lógica compartida está en `createClassesFromSchedules` (`src/services/class-generation.ts`), que usan el endpoint manual, el alta y el cron.
