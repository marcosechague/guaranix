# 0013 — Brodi para el dueño (v1)

Fecha: 2026-11-28 · Estado: propuesta

## Contexto

La Fase 1 del PRD pide "Brodi v1 para el dueño (consultas + resumen semanal)". Las acciones con confirmación ("cancelá la clase del feriado") quedan para Brodi v2 (Fase 2). Brodi tiene que responder con datos reales del box, nunca ver los de otro y no costar más de lo que el plan permite.

## Decisiones

- **Solo lectura.** En v1 Brodi no escribe nada del box: no crea cobros, no cancela clases, no manda mensajes. Lo único que se guarda es la conversación y el uso.
- **Brodi no consulta la base por su cuenta.** La API arma una "foto" del box (cobros del mes y del anterior, deudores, alumnos activos, altas y bajas, asistencia y ocupación, quién no viene hace días, vencimientos próximos, clases de hoy) con los servicios que ya existen, dentro de `withBoxScope` y con el rol de quien pregunta. El modelo responde solo con esa foto; si la pregunta sale de ahí, lo dice. Así no hay herramientas que un texto malicioso (por ejemplo, el nombre de un alumno) pueda disparar, y el aislamiento entre boxes sigue en RLS.
- **Datos mínimos al proveedor.** Nombres y montos sí; cédula, teléfono y email nunca.
- **Quién lo usa.** Dueño y administradores (`MANAGER_ROLES`), porque la foto incluye plata. Coaches y recepción no lo ven.
- **Límite del plan.** Función `brodi` en `platform_plan_features` / `box_feature_overrides`. Una pregunta es un uso: se reserva en `ai_usage` antes de llamar al proveedor, con el mismo candado por box que la importación, así pedidos en paralelo no pasan el límite.
- **Conversación propia.** `brodi_messages` guarda pregunta y respuesta por persona (cada uno ve solo las suyas) y es de solo agregar para el rol del box. Las últimas líneas van con la pregunta para entender "¿y el mes pasado?".
- **Resumen semanal.** Cada lunes a la mañana, para cada box con `brodi` activo, se guarda en `brodi_weekly_summaries` el resumen de la semana anterior con sus números. Si hay cupo, lo escribe el modelo y cuenta como un uso; si no hay cupo o falla el proveedor, se arma con un texto fijo de `es-PY.json`, así el dueño siempre lo recibe. Avisa a dueño y administradores por las notificaciones de staff.
