# 0002 — Esquema de la Fase 0 y aislamiento entre boxes

Fecha: 2026-11-27 · Estado: propuesta

## Contexto

La Fase 0 necesita boxes, personas y roles, planes, clases con reservas, WODs con resultados, cobros manuales y auditoría. `CLAUDE.md` exige que un box nunca pueda ver datos de otro.

## Decisiones

- **Tablas globales mínimas.** Solo `boxes`, `users` (una persona puede estar en varios boxes) y `platform_plans` no tienen `box_id`. `audit_logs` tiene `box_id` opcional para eventos de plataforma. Todo lo demás tiene `box_id NOT NULL`.
- **Aislamiento en dos capas dentro de Postgres:**
  1. **Row Level Security.** Cada pedido de un box corre con `withBoxScope`, que abre una transacción, guarda `app.box_id` y `app.user_id` con `set_config(..., true)` y cambia al rol `guaranix_app` con `SET LOCAL ROLE`. Ese rol no es dueño de las tablas, así que las políticas siempre aplican. Todo es `LOCAL`: termina con la transacción y no se filtra al siguiente pedido del pool de Hyperdrive.
  2. **Claves foráneas compuestas** `(box_id, id)`. Una reserva no puede apuntar a una clase de otro box ni siquiera desde código de sistema.
- **Sin box no se ve nada.** Si `app.box_id` no está seteado, las políticas no coinciden con ninguna fila.
- **Permisos por columna.** Desde un box se puede editar el perfil y la política de reservas del box, pero no su estado, prueba, plan de GuaraniX ni slug. Un usuario solo puede cambiar su nombre; email, teléfono y `is_platform_admin` cambian por flujos del sistema. `audit_logs` es solo inserción y lectura.
- **`withSystemScope`** es para superadmin, login, cron y seeds. Quien lo use autoriza antes y escribe en `audit_logs` si toca datos de un box.
- **Enums en un solo lugar.** Los valores (roles, tipos de plan, estados de reserva, tipos de puntuación…) viven en `packages/shared/src/domain/enums.ts`; los enums de Postgres y los esquemas Zod salen de ahí.
- **Montos en guaraníes enteros** (`integer`) y cargas en **gramos** (62,5 kg = 62500), para no usar decimales.
- **Precio congelado.** `member_plans` guarda el precio y los límites del momento de la venta; cambiar el precio de un plan no reescribe el historial.
- **Deudores.** Se calculan con `charges` abiertos y vencidos; `payments` puede quedar `pending_review` hasta que recepción confirma el comprobante.
- **Tests con PGlite** (Postgres 17 en memoria): corren en CI sin Docker y aplican las mismas migraciones.
- **Plantilla paraguaya en datos.** Los nombres de programas y planes de la plantilla son datos que el box edita, no textos de la interfaz, así que no van en `es-PY.json`. Los precios son de referencia y hay que validarlos con los pilotos.

## Pendiente

- Tablas de login (códigos de un solo uso y sesiones), en el próximo PR.
- Feature flags por box y por plan.
- Probar `pnpm db:migrate` contra una rama de Neon antes del primer deploy (el rol `guaranix_app` se crea en la migración `0000`).
