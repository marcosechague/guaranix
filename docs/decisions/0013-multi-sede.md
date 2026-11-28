# 0013 — Multi-sede

Fecha: 2026-11-28 · Estado: propuesta

## Contexto

La Fase 1 del PRD pide multi-sede: un panel, un alumno, pase entre sedes y reportes por sede. Los boxes que ya existen tienen una sola sede y tienen que seguir andando sin tocar nada.

## Decisiones

- **La sede vive dentro del box.** `locations` es una tabla más del box (`box_id`, política `tenant_isolation`, claves foráneas compuestas). El límite de aislamiento sigue siendo el box: alumnos, planes, coaches, cobros y WODs son del box y se comparten entre sus sedes.
- **Una sede por defecto por box.** Se crea con el box (trigger en `boxes`) y la migración `0018` se la dio a todos los boxes existentes, con el nombre "Sede principal" y la dirección del box. No se puede desactivar ni duplicar (índice único parcial y `check`).
- **Horarios y clases tienen sede** (`class_schedules.location_id`, `classes.location_id`, `NOT NULL`). Si un `INSERT` no la trae, un trigger pone la del horario (para clases generadas) o la sede por defecto. Así el código anterior, los seeds y los tests siguen funcionando; los servicios que saben la sede la pasan igual. Las reservas no guardan sede: la sacan de la clase.
- **Pase entre sedes.** `plan_locations` dice en qué sedes vale un plan; sin filas, vale en todas (igual que `plan_programs` con los programas).
- **Sede habitual del alumno** (`members.home_location_id`, opcional) para reportes por sede. Vacía significa la sede por defecto.
- **Cantidad de sedes.** El box puede tener `1 + boxes.extra_locations` sedes activas; el superadmin cambia `extra_locations` y eso se cobra al precio de sede adicional del plan de GuaraniX.

## API

- `/box/locations`: todos los roles listan (los alumnos solo ven las sedes abiertas); dueño y admin crean y editan. Se audita cada cambio.
- Cerrar una sede: no se puede si es la principal (`default_location_required`) ni si tiene horarios activos (`location_has_schedules`). Mover la principal (`isDefault: true`) deja la anterior abierta.
- Pasar de `1 + extra_locations` sedes abiertas da `location_limit_reached`, al crear o al reabrir.
- Un horario nuevo va a la sede pedida (tiene que estar abierta) o a la principal. Las clases generadas toman la sede del horario.
- `GET /box/classes?locationId=` filtra por sede.
- Reservar revisa, después del programa, que el plan valga en la sede de la clase (`plan_excludes_location`).
