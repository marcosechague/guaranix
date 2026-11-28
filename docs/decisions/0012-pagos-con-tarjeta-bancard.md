# 0012 — Pagos con tarjeta (Bancard) y débito automático

## Contexto

Con la caída de ueno Bank y uPay quedó claro que no podemos depender de un solo procesador. Los boxes quieren cobrar la cuota con tarjeta sin tocar la plata: el dinero tiene que ir directo a la cuenta del box.

## Decisión

### Paquete `packages/payments`

- `PaymentProvider` es la interfaz común: probar claves, crear cliente, guardar tarjeta (formulario del procesador), buscar y borrar tarjeta, cobrar con la tarjeta guardada, cobro con formulario (link de pago), consultar el estado de un pago, reembolsar y leer webhooks.
- Adaptadores: **Bancard vPOS** y un **mock** para tests y desarrollo (rechaza los montos que terminan en 13; claves que empiezan con `invalid` no pasan). Sumar otro procesador no cambia nada fuera del paquete.
- El mock no se puede elegir en producción.

### Cuenta del box

- Cada box conecta **su propia cuenta** (clave pública y privada). Solo el dueño conecta, cambia claves o desconecta; dueño y admin prenden o apagan el débito automático.
- La clave privada se prueba con el procesador antes de guardarse y se guarda cifrada (AES-GCM, `PAYMENTS_SECRETS_KEY`, con el box y el procesador como datos asociados). La API nunca la devuelve: solo los últimos 4 caracteres.
- Requiere la función `card_payments` (por plan de GuaraniX o excepción del box, ver `0009`) y que el box esté en prueba o activo.
- En Ajustes se muestra la URL de confirmación que hay que darle a Bancard: `https://<api>/webhooks/payments/<id de la cuenta>`.

### Tarjeta del alumno

- El alumno carga la tarjeta en el **formulario de Bancard** (iframe de su script). GuaraniX nunca ve ni guarda datos de tarjeta: solo una referencia numérica nuestra, marca, últimos 4 y vencimiento.
- Para guardar la tarjeta tiene que aceptar el débito automático (`acceptAutopay: true`, queda la fecha del consentimiento).
- La tarjeta queda `pending` hasta que la API confirma con el procesador que existe. Una tarjeta nueva reemplaza a la anterior.
- Solo se cobran automáticamente los cargos que vencen desde el día del consentimiento; las deudas viejas van por link o recepción.

### Cobro automático (cron diario, 12:30 UTC = 9:30 en Asunción)

1. **Renovación**: el día antes de que termine un plan mensual o semanal de un alumno con tarjeta activa y sin deudas vencidas, se renueva al precio actual y se abre el cargo. Queda auditado.
2. **Conciliación**: un intento sin respuesta (10 min autopay, 1 h link) se consulta con el procesador.
3. **Cobro** de los cargos que vencen hoy o antes.

- Reintentos: 4 intentos en total, a los días 1, 3 y 7 después del primero. Aviso al alumno en el primer rechazo y en el último: push `card_payment_failed` por el outbox de notificaciones (`0011-notificaciones`), que abre Mi cuota y nunca lleva el link (es un secreto). Un error de claves no avisa al alumno (es del box).
- Dos fases: primero se guarda el intento con su número de pedido, después se llama al procesador fuera de la transacción y al final se aplica el resultado. Así un corte nunca cobra dos veces: el intento queda y se concilia.
- No se cobra automáticamente si hay un pago por link pendiente o aprobado para ese cargo.

### Link de pago

- Recepción genera un link (`/pagar/<token>`) con mensaje listo para WhatsApp (`wa.me`). Se guarda solo el hash del token y vence a los 7 días.
- La página es pública, muestra solo nombre, box, concepto y monto, y tiene rate limit por IP.

### Webhooks

- `POST /webhooks/payments/:accountId`: el id dice con qué clave se verifica la firma. Firma inválida → `401` y queda registrado.
- Todo evento se guarda en `payment_events` (solo inserción: el rol de la app no puede editar ni borrar). Un evento repetido se reconoce y no se aplica dos veces (índice único por `event_key` y bloqueo del intento).
- Un pago aprobado crea un pago `card` confirmado y salda el cargo. Si el monto no coincide o el cargo ya estaba pagado, se registra igual y la auditoría lo marca para revisión.

### Reembolsos

- Solo gestión, solo pagos con tarjeta. En Bancard el único reembolso por API es la **anulación (rollback) del mismo día**; después hay que hacerlo desde el portal de Bancard. El cargo vuelve a quedar abierto.

## Bancard: qué está confirmado y qué no

Confirmado con el SDK público de Bancard (vPOS 0.3): `single_buy`, `single_buy/confirmations`, `single_buy/rollback`, tokens MD5, montos `"N.00"`, solo PYG y URLs de pruebas (`:8888`) y producción.

**A confirmar** con la documentación de vPOS 2.0 que manda Bancard junto con las claves: `cards/new`, `users/:id/cards`, borrar tarjeta, `charge` con `alias_token`, sus tokens y la versión del script de checkout. Están aislados en `packages/payments/src/providers/bancard/`.

## Para activar en un box

1. `wrangler secret put PAYMENTS_SECRETS_KEY` (32 bytes en base64), una sola vez.
2. Prender `card_payments` en el superadmin (plan o box).
3. El dueño carga sus claves de Bancard en Ajustes y le pasa a Bancard la URL de confirmación.

## Pendiente

- Aviso por WhatsApp con el link de pago: necesita una plantilla nueva aprobada por Meta. Mientras tanto, recepción lo manda con el botón de WhatsApp (`wa.me`).
- Probar contra el sandbox de Bancard cuando estén las claves.
- Segundo procesador (ej. Dinelco).
