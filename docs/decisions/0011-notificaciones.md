# 0011 — Notificaciones: push, Telegram y WhatsApp

Fecha: 2026-11-28 · Estado: propuesta

## Contexto

La Fase 0 pide avisos por push (gratis) para reservas, WOD y avisos; Telegram (gratis) para los avisos internos de dueños y coaches; y WhatsApp para recordatorios de cuota, que cuesta por mensaje y por eso va con cupo por plan. Un aviso perdido o repetido molesta, y un WhatsApp repetido además cuesta plata.

## Decisiones

- **Una interfaz, un adaptador por proveedor** (`packages/messaging`). `NotificationChannel.send(dirección, mensaje)` con adaptadores para Web Push (VAPID y cifrado `aes128gcm` propios, con WebCrypto, probados contra el ejemplo del RFC 8291), el Bot API de Telegram y la API Cloud de WhatsApp (Meta, sin intermediarios), más uno de consola para desarrollo y uno en memoria para tests. Cada adaptador traduce los errores a `ChannelError` (`retryable`, `address_gone`, `permanent`), sin tokens ni datos del mensaje.
- **Outbox en Postgres, envío por Cloudflare Queues.** El servicio que cancela una clase o publica un WOD escribe el evento en `notifications` dentro de su misma transacción; el router lo encola recién cuando la transacción confirma (`context.var.outbox`), así un cambio que se deshace nunca avisa. La cola `guaranix-notifications` tiene dos trabajos: `expand` (un evento → una fila en `notification_deliveries` por persona y canal) y `send` (manda una entrega).
- **Idempotencia en datos, no en la cola.** El evento tiene clave única por box (`class_cancelled:<id>`, `membership_due:<cargo>:<días>`); la entrega es única por evento, persona y canal; enviar toma la fila con un `UPDATE … WHERE status = 'queued'`. Mensajes duplicados de la cola o un cron que corre dos veces no mandan nada nuevo.
- **Reintentos con espera creciente** (30 s, 2 min, 8 min, hasta 15 min, o lo que pida el proveedor) y 5 intentos por entrega. Una suscripción push vencida (404/410) o un bot bloqueado (403) se borran. Si un worker se cae a mitad de un envío, push y Telegram se reintentan; **WhatsApp no** (puede haber salido y estar cobrado), queda como `failed: interrupted`.
- **Barrido cada 10 minutos** que vuelve a encolar eventos sin expandir y entregas trabadas, si tienen menos de un día. Lo viejo no se manda tarde.
- **Preferencias por persona** (`notification_preferences`, solo lo que se apagó; sin fila = prendido) por tema (`bookings`, `workouts`, `billing`, `staff`) y canal. Suscripciones push, vínculos de Telegram y preferencias son de la persona, no del box: como las tablas de login, el rol `guaranix_app` no las ve y las rutas filtran por el usuario de la sesión.
- **Quién recibe se decide al expandir**, no al registrar el evento: alguien que se dio de baja en el medio no recibe nada, y los boxes suspendidos no avisan.
- **WhatsApp es la función `whatsapp`** de `platform_plan_features` / `box_feature_overrides` (ver 0009). Un "uso" es un mensaje en cola, enviándose o enviado este mes; los que fallan o se saltean no cuentan. Al expandir se toma un lock por box, se mira cuánto queda y lo que no entra se guarda como `skipped: quota_reached`, así el dueño puede ver qué no salió. Sin la función, no se crea nada para WhatsApp.
- **Mensajes de WhatsApp con plantillas aprobadas.** Los recordatorios los inicia GuaraniX, y Meta solo deja hacerlo con plantillas (`guaranix_cuota_por_vencer`, `guaranix_cuota_vencida`). Sale todo desde el número de GuaraniX; el nombre del box va como parámetro.
- **Telegram se vincula con un enlace de un solo uso** (`t.me/<bot>?start=<código>`, 15 min, se guarda solo el hash). El webhook valida `X-Telegram-Bot-Api-Secret-Token` y es la única ruta sin `Origin` ni sesión (`WEBHOOK_ROUTES`).
- **Textos en es-PY** (`notifications.*`), renderizados al expandir y guardados en la entrega, para que un reintento mande exactamente lo mismo.

## Eventos

| Evento                       | A quién                                                                                | Canal           |
| ---------------------------- | -------------------------------------------------------------------------------------- | --------------- |
| Reserva confirmada           | El alumno, solo si lo anotó recepción                                                  | Push            |
| Te tocó lugar (lista espera) | El alumno que entró                                                                    | Push            |
| Clase cancelada              | Reservados y en espera                                                                 | Push            |
| Clase cancelada (interno)    | Coach de la clase y gestión, menos quien canceló                                       | Telegram        |
| WOD publicado                | Alumnos activos (WOD de hoy o mañana; si se cargó antes, a las 20:00 del día anterior) | Push            |
| Cuota por vencer             | 3 días antes y el día del vencimiento, 09:00                                           | Push y WhatsApp |
| Cuota vencida                | 1 y 7 días después, 09:00                                                              | Push y WhatsApp |
| Resumen de cuotas vencidas   | Dueño y admins, todos los días 09:00 si hay deuda                                      | Telegram        |

## Pendiente

- Historial de envíos y consumo de WhatsApp a la vista del dueño (los datos ya están en `notification_deliveries`).
- Push en el panel del box (hoy el panel solo usa Telegram).
- Que Brodi responda por Telegram y WhatsApp (Fase 2).
