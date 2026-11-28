# Notificaciones: qué configurar

Push, Telegram y WhatsApp andan por separado: cada canal se prende cuando tiene sus claves. Sin claves, en desarrollo los mensajes de Telegram y WhatsApp se imprimen en la terminal de la API (`[dev telegram]`, `[dev whatsapp]`). Cómo funciona por dentro: `docs/decisions/0011-notificaciones.md`.

## 1. Cola de Cloudflare (una vez)

```sh
cd apps/api
pnpm wrangler queues create guaranix-notifications
pnpm wrangler queues create guaranix-notifications-dlq
```

`wrangler.jsonc` ya declara la cola, el consumidor y los cron (`0 12 * * *` recordatorios, `0 23 * * *` WOD de mañana, `*/10 * * * *` barrido). Sin la cola no sale nada, pero tampoco se pierde: los eventos quedan en la base y el barrido los encola cuando exista.

## 2. Push (Web Push con VAPID, gratis)

1. Generá el par de claves (una vez por ambiente):
   ```sh
   pnpm --filter @guaranix/messaging vapid:generate
   ```
2. La pública va en `vars` de `apps/api/wrangler.jsonc` (`VAPID_PUBLIC_KEY`); la privada es secreto:
   ```sh
   pnpm wrangler secret put VAPID_PRIVATE_KEY
   pnpm wrangler secret put VAPID_SUBJECT   # mailto:soporte@guaranix.com.py
   ```
3. No cambies las claves después de lanzar: todas las suscripciones dejan de andar y cada alumno tiene que volver a activar.

En iPhone, push solo anda con GuaraniX agregada a la pantalla de inicio (iOS 16.4 o más). En Android y en escritorio anda desde el navegador.

## 3. Telegram (gratis, para dueños y coaches)

1. En Telegram, hablale a **@BotFather**, `/newbot`, nombre "GuaraniX" y un usuario como `GuaranixBot`. Te da el token.
2. Secretos y variable:
   ```sh
   pnpm wrangler secret put TELEGRAM_BOT_TOKEN
   pnpm wrangler secret put TELEGRAM_WEBHOOK_SECRET   # openssl rand -hex 32
   ```
   y `TELEGRAM_BOT_USERNAME` (sin `@`) en `vars`.
3. Registrá el webhook (con la URL pública de la API y el mismo secreto):
   ```sh
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d url=https://<api>/integrations/telegram/webhook \
     -d secret_token=<TELEGRAM_WEBHOOK_SECRET> \
     -d 'allowed_updates=["message"]'
   ```
4. Cada persona del staff entra al panel, **Cuenta > Notificaciones > Conectar Telegram**, abre el enlace y toca Iniciar.

## 4. WhatsApp (API Cloud de Meta, con costo)

1. Cuenta de **Meta Business** verificada (business.facebook.com) a nombre de GuaraniX.
2. En developers.facebook.com, una app de tipo **Business** con el producto **WhatsApp**. Agregá un número propio (que no esté usando WhatsApp común) y verificalo. Anotá el **Phone number ID** (no es el número).
3. Un **usuario del sistema** en Business Settings con permiso `whatsapp_business_messaging` sobre esa cuenta, y un token permanente.
4. Un medio de pago en WhatsApp Manager: Meta cobra por mensaje de plantilla de "utilidad" entregado.
5. Creá y mandá a aprobar estas dos plantillas, categoría **Utility**, idioma **Spanish (es)**, con este texto exacto (el orden de las variables importa):

   **`guaranix_cuota_por_vencer`**

   > Hola {{1}}, te recordamos que tu cuota de {{2}} en {{3}} vence el {{4}}. Podés pagarla desde la app de GuaraniX o en recepción.

   **`guaranix_cuota_vencida`**

   > Hola {{1}}, tu cuota de {{2}} en {{3}} venció el {{4}}. Si ya pagaste, ignorá este mensaje. Si no, podés pagarla desde la app de GuaraniX o en recepción.

   Variables: 1 nombre del alumno, 2 monto (`₲ 300.000`), 3 nombre del box, 4 fecha (`1 de diciembre`). Si cambiás el texto o el orden, cambialo también en `apps/api/src/services/notifications/templates.ts`.

6. Secretos y variables:
   ```sh
   pnpm wrangler secret put WHATSAPP_ACCESS_TOKEN
   ```
   y en `vars`: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_LANGUAGE` (`es`).
7. En el superadmin, **Planes > (plan) > WhatsApp**: prendelo y poné cuántos mensajes por mes incluye. Para un box puntual, en su ficha. Lo que pase el cupo no sale y queda registrado como `quota_reached`.

Los recordatorios van al teléfono del alumno cargado en el box (formato `+595…`). Mientras la app de Meta esté en modo de prueba, solo llegan a los números que agregues como destinatarios de prueba.

## Variables y secretos, resumen

| Nombre                       | Tipo     | Para qué                                     |
| ---------------------------- | -------- | -------------------------------------------- |
| `VAPID_PUBLIC_KEY`           | variable | Push: la usan las apps para suscribirse      |
| `VAPID_PRIVATE_KEY`          | secreto  | Push: firma los envíos                       |
| `VAPID_SUBJECT`              | secreto  | Push: contacto para los servicios de push    |
| `TELEGRAM_BOT_TOKEN`         | secreto  | Telegram                                     |
| `TELEGRAM_BOT_USERNAME`      | variable | Telegram: arma el enlace `t.me`              |
| `TELEGRAM_WEBHOOK_SECRET`    | secreto  | Telegram: prueba que el webhook es de ellos  |
| `WHATSAPP_ACCESS_TOKEN`      | secreto  | WhatsApp                                     |
| `WHATSAPP_PHONE_NUMBER_ID`   | variable | WhatsApp: número que envía                   |
| `WHATSAPP_TEMPLATE_LANGUAGE` | variable | WhatsApp: idioma de las plantillas (`es`)    |
| `ADMIN_APP_URL`              | variable | Enlaces al panel en los mensajes de Telegram |
