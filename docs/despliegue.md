# Despliegue en Cloudflare

Cómo se publica GuaraniX y qué hay que configurar una sola vez. Por qué se armó así: [`docs/decisions/0012-despliegue-en-cloudflare.md`](decisions/0012-despliegue-en-cloudflare.md).

## Qué se publica

Dos ambientes iguales y separados: **staging** (pruebas, se actualiza solo) y **production** (los boxes reales, se actualiza a mano).

| Pieza                  | Staging                                      | Producción                                     |
| ---------------------- | -------------------------------------------- | ---------------------------------------------- |
| App del alumno         | `https://app-staging.guaranix.com.py`        | `https://app.guaranix.com.py`                  |
| Panel del box          | `https://panel-staging.guaranix.com.py`      | `https://panel.guaranix.com.py`                |
| Plataforma             | `https://plataforma-staging.guaranix.com.py` | `https://plataforma.guaranix.com.py`           |
| API                    | `https://api-staging.guaranix.com.py`        | `https://api.guaranix.com.py`                  |
| Worker de la API       | `guaranix-api-staging`                       | `guaranix-api-production`                      |
| Workers de las apps    | `guaranix-{member,admin,platform}-staging`   | `guaranix-{member,admin,platform}-production`  |
| Base de datos          | Proyecto de Neon `guaranix-staging`          | Proyecto de Neon `guaranix-production`         |
| Hyperdrive             | `guaranix-staging`                           | `guaranix-production`                          |
| Comprobantes (R2)      | `guaranix-receipts-staging`                  | `guaranix-receipts-production`                 |
| Cola de notificaciones | `guaranix-notifications-staging` (+ `-dlq`)  | `guaranix-notifications-production` (+ `-dlq`) |

Las tres apps son Workers que solo sirven archivos estáticos (el build de Vite) y devuelven `index.html` en cualquier ruta. La API es el Worker de Hono con sus cron, la cola y el bucket.

**Todo tiene que colgar del mismo dominio.** La cookie de sesión es `SameSite=Lax` y vive en el host de la API: el navegador solo la manda si la app y la API son subdominios del mismo sitio. Por eso no se usan las direcciones `*.workers.dev` (están apagadas).

### Dónde se cambia el dominio

Si el dominio no es `guaranix.com.py`, se cambia en estos cinco archivos, y `pnpm check:deploy` (también corre en CI) avisa si quedaron distintos:

- `deploy/environments.json`: con estas URLs se arman las apps.
- `apps/api/wrangler.jsonc`: `routes`, `ALLOWED_ORIGINS`, `PUBLIC_API_URL`, `ADMIN_APP_URL`.
- `apps/member/wrangler.jsonc`, `apps/admin/wrangler.jsonc`, `apps/platform/wrangler.jsonc`: `routes`.

## Cómo se publica

| Workflow (`.github/workflows/`) | Cuándo corre                        | Qué hace                                                    |
| ------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `ci.yml`                        | Cada PR y cada push a `main`        | Formato, lint, guardas, typecheck, tests, build             |
| `deploy-staging.yml`            | Cuando CI pasa en `main` (o a mano) | Publica staging                                             |
| `deploy-production.yml`         | Al crear un tag `v*` (o a mano)     | Publica producción                                          |
| `cloudflare-setup.yml`          | A mano, una vez por ambiente        | Crea bucket, colas y Hyperdrive; muestra el `HYPERDRIVE_ID` |

Cada deploy (`deploy.yml`) hace, en orden:

1. Revisa que el environment de GitHub tenga `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL` y `HYPERDRIVE_ID`. Si falta alguno, avisa y no hace nada (así `main` sigue en verde mientras no esté configurado).
2. `pnpm check:deploy`: dominios consistentes.
3. **Migraciones** (`pnpm db:migrate`) contra Neon.
4. **Bootstrap** (`pnpm --filter @guaranix/db db:bootstrap`): crea los planes de GuaraniX que falten y deja como superadmin a `PLATFORM_ADMIN_EMAIL`. Nunca pisa un plan editado ni carga datos demo.
5. **API**: arma el archivo de secretos con los del environment (`scripts/deploy/write-secrets-file.mjs`, solo los nombres permitidos) y corre `wrangler deploy --env <ambiente> --secrets-file`. Si falta un secreto obligatorio, el deploy falla antes de subir nada.
6. **Apps**: `vite build` con `VITE_API_URL`, `VITE_ADMIN_URL` y `VITE_PLATFORM_URL` del ambiente, y `wrangler deploy` de cada una.
7. **Telegram**: registra el webhook si hay bot configurado.
8. **Prueba de humo**: `GET /health` de la API (tiene que decir el ambiente correcto) y la portada de cada app.

Dos deploys del mismo ambiente nunca corren a la vez: el segundo espera.

### Publicar en producción

Cuando staging está bien probado:

```sh
git tag v0.1.0
git push origin v0.1.0
```

O en GitHub, **Actions > Deploy production > Run workflow**, eligiendo la rama o el tag. Si al environment `production` le ponés "Required reviewers" (Settings > Environments), cada deploy espera tu aprobación.

### Volver atrás

- **Código**: **Actions > Deploy production > Run workflow** con el tag anterior. Para algo urgente, en Cloudflare: **Workers > guaranix-api-production > Deployments > Rollback** (lo mismo con cada app).
- **Base de datos**: las migraciones solo van para adelante. Cada migración tiene que dejar andando la versión anterior del código (primero se agrega, en otro release se saca), así un rollback de código no rompe nada. Si se rompen datos, Neon permite restaurar la base a un momento anterior (**Branches > Restore**), dentro del historial que guarda tu plan.

## Configuración inicial (una vez)

### 1. Cuentas

- **Cloudflare**: plan Workers Paid (USD 5 por mes, recomendado). El plan gratis corta cada pedido a 10 ms de CPU (el login con contraseña lo pasa) y permite solo 5 cron por cuenta (la API usa 4 por ambiente).
- **Neon**: dos proyectos, `guaranix-staging` y `guaranix-production`, Postgres 17, región **AWS São Paulo (sa-east-1)**, la más cerca de Paraguay. El plan gratis alcanza para el piloto; para producción con datos reales conviene uno pago por el historial para restaurar.
- **Resend** (emails), **Google Cloud** (login con Google) y el dominio. Turnstile viene con Cloudflare.

### 2. Dominio en Cloudflare

Agregá el dominio en Cloudflare (**Add a domain**, plan Free) y cambiá los nameservers en NIC.py (o donde esté registrado) por los que te da Cloudflare. Los subdominios de la tabla los crea el deploy solo (custom domains de Workers), con su certificado.

### 3. Token de Cloudflare

**My Profile > API Tokens > Create Token > Custom token**, con:

- Account: **Workers Scripts: Edit**, **Workers R2 Storage: Edit**, **Queues: Edit**, **Hyperdrive: Edit**, **Account Settings: Read**.
- Zone (solo el dominio de GuaraniX): **Workers Routes: Edit**, **DNS: Edit**, **Zone: Read**.

El **Account ID** está en la portada de la cuenta (columna de la derecha en Workers & Pages).

### 4. Environments de GitHub

En el repo, **Settings > Environments**, creá `staging` y `production`. En cada uno van los secretos y variables de abajo, con valores **distintos** por ambiente (sobre todo `AUTH_SECRET` y `AI_SECRETS_KEY`). Guardá una copia de cada secreto en un gestor de contraseñas: GitHub no deja volver a verlos.

### 5. Recursos de Cloudflare

Con `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y `DATABASE_URL` ya cargados: **Actions > Cloudflare setup > Run workflow**, primero `staging` y después `production`. Al terminar, el resumen muestra el `HYPERDRIVE_ID`: cargalo como variable del mismo environment.

### 6. Servicios externos

- **Turnstile** (Cloudflare > Turnstile > Add widget): un widget por ambiente, modo "Managed", con los hostnames de las tres apps de ese ambiente. Da la site key y la secret key.
- **Google** (ver "Configurar Google" en el `README.md`): en el cliente OAuth, orígenes JavaScript autorizados = las tres apps; URI de redireccionamiento = `https://api-staging.guaranix.com.py/auth/google/callback` y `https://api.guaranix.com.py/auth/google/callback`. Para que cualquiera pueda entrar, publicá la pantalla de consentimiento (sale del modo prueba).
- **Resend**: **Domains > Add domain** con `guaranix.com.py` y cargá en Cloudflare DNS los registros que te da (SPF, DKIM). `EMAIL_FROM` = `GuaraniX <no-responder@guaranix.com.py>`.
- Push, Telegram y WhatsApp son opcionales: [`docs/notificaciones.md`](notificaciones.md).

### 7. Primer deploy y primer login

1. **Actions > Deploy staging > Run workflow**. La primera vez los certificados de los dominios pueden tardar unos minutos; la prueba de humo reintenta.
2. Entrá a la plataforma de staging con Google (con el email de `PLATFORM_ADMIN_EMAIL`) o con "Olvidé mi contraseña" desde la app del alumno para ponerte una contraseña.
3. Creá un box de prueba y probá el flujo completo. Cuando ande, `git tag v0.1.0 && git push origin v0.1.0` para producción.

## Secretos y variables

En cada environment de GitHub. Los **secretos** no se pueden volver a ver; las **variables** sí (son valores públicos o ids). El deploy sube a la API solo los nombres de esta lista; los de Cloudflare y la base nunca llegan al Worker.

### Del deploy

| Nombre                  | Tipo     | Qué es                                                                                                              |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | secreto  | Token del paso 3                                                                                                    |
| `CLOUDFLARE_ACCOUNT_ID` | variable | Id de la cuenta de Cloudflare                                                                                       |
| `DATABASE_URL`          | secreto  | Connection string **directa** de Neon (sin `-pooler`), con `?sslmode=require`. La usan las migraciones y Hyperdrive |
| `HYPERDRIVE_ID`         | variable | Lo muestra el workflow Cloudflare setup                                                                             |
| `PLATFORM_ADMIN_EMAIL`  | variable | Tu email: el bootstrap lo deja como superadmin                                                                      |

### De la API (obligatorios: sin ellos el deploy falla)

| Nombre                 | Tipo     | Cómo se consigue                                                               |
| ---------------------- | -------- | ------------------------------------------------------------------------------ |
| `AUTH_SECRET`          | secreto  | `openssl rand -base64 48`. **Si cambia, todas las contraseñas dejan de andar** |
| `TURNSTILE_SITE_KEY`   | variable | Widget de Turnstile del ambiente                                               |
| `TURNSTILE_SECRET_KEY` | secreto  | Mismo widget                                                                   |
| `GOOGLE_CLIENT_ID`     | variable | Cliente OAuth de Google                                                        |
| `GOOGLE_CLIENT_SECRET` | secreto  | Mismo cliente                                                                  |
| `RESEND_API_KEY`       | secreto  | Resend > API Keys (permiso "Sending access")                                   |
| `EMAIL_FROM`           | variable | `GuaraniX <no-responder@guaranix.com.py>` (dominio verificado en Resend)       |

### De la API (opcionales: cada uno prende una función)

| Nombre                     | Tipo     | Para qué                                                                                                                                                                    |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_SECRETS_KEY`           | secreto  | IA. `openssl rand -base64 32`. Si cambia, hay que cargar de nuevo las claves de IA                                                                                          |
| `PAYMENTS_SECRETS_KEY`     | secreto  | Cobro con tarjeta: cifra las claves privadas de Bancard de cada box. `openssl rand -base64 32`, distinta de `AI_SECRETS_KEY`. Si cambia, cada box carga de nuevo sus claves |
| `VAPID_PUBLIC_KEY`         | variable | Push (`pnpm --filter @guaranix/messaging vapid:generate`)                                                                                                                   |
| `VAPID_PRIVATE_KEY`        | secreto  | Push                                                                                                                                                                        |
| `VAPID_SUBJECT`            | secreto  | Push: `mailto:soporte@guaranix.com.py`                                                                                                                                      |
| `TELEGRAM_BOT_TOKEN`       | secreto  | Telegram (un bot por ambiente)                                                                                                                                              |
| `TELEGRAM_BOT_USERNAME`    | variable | Telegram, sin `@`                                                                                                                                                           |
| `TELEGRAM_WEBHOOK_SECRET`  | secreto  | Telegram: `openssl rand -hex 32`                                                                                                                                            |
| `WHATSAPP_ACCESS_TOKEN`    | secreto  | WhatsApp                                                                                                                                                                    |
| `WHATSAPP_PHONE_NUMBER_ID` | variable | WhatsApp                                                                                                                                                                    |

`APP_ENV`, `ALLOWED_ORIGINS`, `PUBLIC_API_URL`, `ADMIN_APP_URL` y `WHATSAPP_TEMPLATE_LANGUAGE` no van en GitHub: están en `apps/api/wrangler.jsonc` por ambiente.

Para sumar un secreto nuevo a la API: agregalo a `Bindings` (`apps/api/src/env.ts`), a la lista de `scripts/deploy/write-secrets-file.mjs` (obligatorio u opcional) y a esta tabla. Sacar uno del environment no lo borra del Worker: los deploys solo agregan o actualizan; para borrarlo, `wrangler secret delete <NOMBRE> --env <ambiente>`.

## Problemas comunes

- **El deploy dice "not set up yet"**: falta alguno de los cuatro del paso 1 en ese environment.
- **"Missing required configuration" en la API**: falta un secreto obligatorio en el Worker. Revisá la tabla y volvé a correr el deploy.
- **La app abre pero el login no guarda la sesión**: la app y la API no están en el mismo dominio, o el origen de la app no está en `ALLOWED_ORIGINS`. `pnpm check:deploy` lo revisa.
- **Google dice `redirect_uri_mismatch`**: falta `https://<api>/auth/google/callback` en el cliente OAuth.
- **El captcha no aparece o falla**: el hostname de la app no está en el widget de Turnstile del ambiente.
- **Hyperdrive no conecta**: la `DATABASE_URL` es la "pooled" de Neon o cambió la contraseña. Con una contraseña nueva, editá el Hyperdrive en Cloudflare (**Hyperdrive > guaranix-<ambiente> > Settings**) además del secreto de GitHub.
