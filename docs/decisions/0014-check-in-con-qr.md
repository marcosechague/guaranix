# 0014 — Check-in con QR en la entrada

Fecha: 2026-11-28 · Estado: propuesta

## Contexto

La Fase 1 pide check-in con QR en la entrada del box (tablet o celular): solo entran los que tienen la cuota al día y queda la asistencia real. Hasta ahora la asistencia la marcaba el coach a mano en la lista de la clase.

## Decisiones

- **El alumno muestra su QR y el equipo de la entrada lo escanea.** El aparato de la entrada usa el panel del box con una sesión de staff (recepción, coach o gestión), así el resultado (verde o rojo, y por qué) lo ve el box y no solo el alumno. El alumno no necesita usar la cámara.
- **El QR es un pase firmado que dura 2 minutos** (`gx1.<alumno>.<vence>.<HMAC>`, firmado con `AUTH_SECRET` e incluyendo el `box_id`). La app lo pide de nuevo antes de que venza. Así una captura de pantalla mandada a otro no sirve, un pase de otro box no abre esta entrada y emitir un pase no escribe nada en la base. Necesita conexión: el box suele tener wifi y el pase sin conexión quedaría para más adelante.
- **"Cuota al día" = alumno activo, sin cargos abiertos vencidos** (lo mismo que la lista de deudores) **y con un plan que cubra la clase**. Un cargo que vence hoy todavía no frena la entrada.
- **Qué clase**: las que empiezan dentro de los próximos 30 minutos o ya empezaron y no terminaron. Si el alumno tiene lugar reservado en una, se marca como asistió (con `checked_in_at`), con las mismas reglas de créditos que la lista del coach. Si no reservó, se lo anota en la próxima clase que todavía no empezó, tiene lugar y su plan cubre, y se marca como asistió; no entra en lista de espera ni recibe el aviso de reserva.
- **Un "no" no escribe nada** y dice por qué (`fee_overdue` con lo que debe, `no_valid_plan`, `class_full`, `waitlisted`, `no_class_now`, …), para que la pantalla le diga al alumno qué hacer.
- **Sin tablas nuevas**: la asistencia ya vive en `bookings` (`attended`, `checked_in_at`). Con varias sedes (ver 0013-multi-sede), la entrada podrá filtrar las clases por `classes.location_id`.

## Rutas

- `GET /box/me/check-in-pass` (alumno): el pase y cuándo vence.
- `POST /box/check-ins` (staff) `{ pass }`: el resultado (`checked_in`, `already_checked_in` o `denied` con el motivo).
