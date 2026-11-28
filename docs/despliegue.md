# Despliegue en Cloudflare

Cómo se publica GuaraniX y qué hay que configurar una sola vez. Por qué se armó así: [`docs/decisions/0012-despliegue-en-cloudflare.md`](decisions/0012-despliegue-en-cloudflare.md).

## Qué se publica

Por ahora hay **un solo ambiente, producción**, en la dirección gratis de Cloudflare:

| Qué            | Dirección                                                  |
| -------------- | ---------------------------------------------------------- |
| App del alumno | `https://guaranix.<tu-subdominio>.workers.dev/`            |
| Panel del box  | `https://guaranix.<tu-subdominio>.workers.dev/panel/`      |
| Plataforma     | `https://guaranix.<tu-subdominio>.workers.dev/plataforma/` |
| API            | `https://guaranix.<tu-subdominio>.workers.dev/api/`        |

`<tu-subdominio>` es el que elegís una vez en Cloudflare (**Workers & Pages > tu subdominio workers.dev**). El deploy lo lee solo.

| Pieza                    | Nombre                                                   |
| ------------------------ | -------------------------------------------------------- |
| Worker público (gateway) | `guaranix` (`apps/gateway`)                              |
| Worker de la API         | `guaranix-api-production` (sin dirección pública propia) |
| Base de datos            | Proyecto de Neon `guaranix-production`                   |
| Hyperdrive               | `guaranix-production`                                    |
| Comprobantes (R2)        | `guaranix-receipts-production`                           |
| Cola de notificaciones   | `guaranix-notifications-production` (+ `-dlq`)           |

### Por qué todo va en una sola dirección

La cookie de sesión es `SameSite=Lax`: el navegador solo la manda si la app y la API son el mismo sitio. `workers.dev` es un "sufijo público" (como `.com.py`), así que `guaranix-admin.x.workers.dev` y `guaranix-api.x.workers.dev` serían sitios distintos y el login no quedaría guardado. Por eso un solo Worker, el **gateway**, sirve las tres apps en carpetas distintas y le pasa `/api/*` a la API por un _service binding_ (interno, sin salir a internet). Así las tres apps comparten la sesión, y "entrar como" un box desde la plataforma sigue andando.

El gateway casi no trabaja: los archivos (JS, CSS, imágenes) los sirve Cloudflare directo, sin correr código. El Worker solo corre para `/api/*` y para las rutas de las apps (por ejemplo `/panel/alumnos`), donde devuelve el `index.html` de la app que corresponde.

### Pasar a un dominio propio después

1. Agregá el dominio en Cloudflare y en el gateway (`apps/gateway/wrangler.jsonc`, `env.production.routes` con `custom_domain: true`).
2. Cargá la variable `PUBLIC_URL` (por ejemplo `https://app.guaranix.com.py`) en el environment de GitHub.
3. Actualizá los hostnames en Turnstile, Google y Resend, y volvé a publicar.

No hace falta tocar código: todas las direcciones salen de `PUBLIC_URL`.

### Sumar staging después

Copiá `env.production` como `env.staging` en `apps/api/wrangler.jsonc` y `apps/gateway/wrangler.jsonc` (con nombres `-staging`), creá el environment `staging` en GitHub con su propia base de Neon, sumá `staging` a las opciones de `cloudflare-setup.yml` y agregá un `deploy-staging.yml` que llame a `deploy.yml` con `environment: staging`. `pnpm check:deploy` revisa hoy solo producción.

## Cómo se publica

Hay dos formas de hacer lo mismo: con los workflows de GitHub Actions o desde tu compu con `pnpm deploy:production` (ver "Publicar desde tu compu"). Mientras el repo sea privado y no queden minutos de Actions en el mes, usá la de tu compu: los workflows no corren.

| Workflow (`.github/workflows/`) | Cuándo corre                   | Qué hace                                                    |
| ------------------------------- | ------------------------------ | ----------------------------------------------------------- |
| `ci.yml`                        | Cada PR y cada push a `main`   | Formato, lint, guardas, typecheck, tests, build             |
| `deploy-production.yml`         | Al crear un tag `v*`, o a mano | Publica producción                                          |
| `cloudflare-setup.yml`          | A mano, una vez                | Crea bucket, colas y Hyperdrive; muestra el `HYPERDRIVE_ID` |

Mergear a `main` **no** publica nada: producción sale solo cuando vos lo decidís.

Cada deploy (`deploy.yml`) hace, en orden:

1. Revisa que el environment `production` de GitHub tenga `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL` y `HYPERDRIVE_ID`. Si falta alguno, avisa y no hace nada.
2. `pnpm check:deploy` y calcula la dirección pública (`PUBLIC_URL`, o la de workers.dev).
3. **Migraciones** (`pnpm db:migrate`) contra Neon.
4. **Bootstrap** (`pnpm --filter @guaranix/db db:bootstrap`): crea los planes de GuaraniX que falten y deja como superadmin a `PLATFORM_ADMIN_EMAIL`. Nunca pisa un plan editado ni carga datos demo.
5. **API**: arma el archivo de secretos con los del environment (`scripts/deploy/write-secrets-file.mjs`, solo los nombres permitidos) y corre `wrangler deploy --env production --secrets-file … --var …`. Las direcciones (`ALLOWED_ORIGINS`, `PUBLIC_API_URL`, `ADMIN_APP_URL`, `MEMBER_APP_URL`) salen de la dirección pública. Si falta un secreto obligatorio, falla antes de subir nada.
6. **Apps y gateway**: `vite build` de las tres (el panel con base `/panel/`, la plataforma con `/plataforma/`), las junta en `apps/gateway/dist` (`scripts/deploy/assemble-site.mjs`), escribe los encabezados de seguridad (`scripts/deploy/write-headers.mjs`: CSP que solo deja hablar con el mismo sitio y Turnstile, sin iframes ajenos, sin referrer con ruta) y publica el gateway.
7. **Telegram**: registra el webhook si hay bot configurado.
8. **Prueba de humo**: `/api/health` (tiene que decir `production`), la portada de las tres apps y una ruta interna del panel.

Dos deploys nunca corren a la vez: el segundo espera.

### Publicar

```sh
git tag v0.1.0
git push origin v0.1.0
```

O en GitHub, **Actions > Deploy production > Run workflow**. Si al environment `production` le ponés "Required reviewers" (Settings > Environments), cada deploy espera tu aprobación.

### Publicar desde tu compu (sin GitHub Actions)

Hace exactamente los mismos pasos que `deploy.yml` (migraciones, bootstrap, API, apps + gateway, Telegram, prueba de humo), con los valores de un archivo local en vez de los del environment de GitHub.

Requisitos: Node 22+, pnpm (`corepack enable`) y el repo clonado y actualizado.

1. Una sola vez: `cp deploy/production.env.example .env.production` y completalo con los mismos nombres y valores de la tabla "Secretos y variables", salvo la base: acá se llama `PROD_DATABASE_URL` (ver "La URL de producción no se llama `DATABASE_URL`"). Está en `.gitignore` y `pnpm check:secrets` impide commitearlo; aun así, tratalo como una contraseña.
2. Una sola vez: `pnpm install` y después `pnpm deploy:setup`. Crea el bucket, las colas y el Hyperdrive, y muestra el `HYPERDRIVE_ID`: copialo a `.env.production`.
3. Cada vez que publiques:
   ```sh
   git checkout main && git pull
   pnpm deploy:production
   ```
   Publica el commit en el que estás, y se niega si hay cambios sin commitear. Al terminar muestra los cuatro links.

El script cambia `apps/api/wrangler.jsonc` solo mientras corre (para poner el `HYPERDRIVE_ID`) y lo deja como estaba, y el archivo temporal con los secretos se borra siempre, aunque algo falle. Tu `.env` de desarrollo no se mezcla: lo de `.env.production` tiene prioridad, y el script borra cualquier `DATABASE_URL` antes de empezar.

### La URL de producción no se llama `DATABASE_URL`

`DATABASE_URL` es la base de desarrollo: la leen `pnpm db:migrate`, `db:seed`, `db:studio` y los tests. Si la URL de producción estuviera guardada con ese nombre en algún lugar que se exporta a todo (tu terminal, o las variables del entorno de Claude Code en la nube), cualquiera de esos comandos podría escribir en producción por error.

Por eso, fuera de GitHub se llama **`PROD_DATABASE_URL`**: en `.env.production`, en tu terminal y en el entorno de la nube. `pnpm deploy:setup` y `pnpm deploy:production` la leen y se la pasan como `DATABASE_URL` solo a las migraciones y al bootstrap. En el environment `production` de GitHub sigue siendo el secreto `DATABASE_URL`, porque ahí solo lo ven los workflows de deploy.

### Volver atrás

- **Código**: **Actions > Deploy production > Run workflow** eligiendo el tag anterior, o desde tu compu `git checkout <tag anterior>` y `pnpm deploy:production`. Para algo urgente, en Cloudflare: **Workers > guaranix-api-production > Deployments > Rollback** (y lo mismo con `guaranix`).
- **Base de datos**: las migraciones solo van para adelante. Cada migración tiene que dejar andando la versión anterior del código (primero se agrega, en otro release se saca), así un rollback de código no rompe nada. Si se rompen datos, Neon permite restaurar la base a un momento anterior (**Branches > Restore**), dentro del historial que guarda tu plan.

## Costos

| Servicio   | Plan         | Costo         | Notas                                                                                                                    |
| ---------- | ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Cloudflare | Workers Paid | USD 5 por mes | Ver abajo                                                                                                                |
| Neon       | Free         | 0             | Alcanza para el piloto. Para datos reales de muchos boxes conviene un plan pago, que guarda más historial para restaurar |
| Resend     | Free         | 0             | 3.000 emails por mes. Necesita un dominio propio para mandar a cualquiera (ver "Sin dominio propio")                     |
| Turnstile  | Free         | 0             |                                                                                                                          |
| Google     | -            | 0             |                                                                                                                          |

**¿Hace falta pagar Cloudflare?** Todo lo que usa GuaraniX existe en el plan gratis (Workers, Hyperdrive, R2 y Queues; los cron son 5 por cuenta entera, así que mientras la cuenta esté en el plan gratis producción corre solo 3: clases, recordatorios de cuota y WODs. El cobro con tarjeta, el reenvío de avisos y el resumen de Brodi quedan apagados en `apps/api/wrangler.jsonc` hasta configurar pagos, avisos o IA y pasar a Workers Paid), salvo un límite: **10 ms de CPU por pedido**. Guardar o revisar una contraseña (PBKDF2 con 100.000 vueltas, `apps/api/src/lib/password.ts`) tarda unos 14 ms de CPU, así que el registro, el login con contraseña y el cambio de contraseña pueden fallar con el error 1102 de Cloudflare. Bajar las vueltas para entrar en 10 ms debilitaría las contraseñas por debajo de lo recomendado, así que no lo hacemos. El resto de la app y el login con Google sí entran en el plan gratis.

Se puede arrancar en el plan gratis para probar. Si el login con contraseña falla, se pasa a Workers Paid desde el panel de Cloudflare, sin cambiar nada en el código ni volver a publicar.

## Configuración inicial (una vez)

### 1. Cuentas

- **Cloudflare**. En **Workers & Pages**, elegí tu subdominio de workers.dev (por ejemplo `marcos` → `guaranix.marcos.workers.dev`).
- **Neon**: un proyecto `guaranix-production`, Postgres 17, región **AWS São Paulo (sa-east-1)**, la más cerca de Paraguay. Copiá la connection string **directa** (sin `-pooler`).
- **Resend** y **Google Cloud** (login con Google). Turnstile viene con Cloudflare.

### 2. Token de Cloudflare

**My Profile > API Tokens > Create Token > Custom token**, con permisos de cuenta: **Workers Scripts: Edit**, **Workers R2 Storage: Edit**, **Queues: Edit**, **Hyperdrive: Edit** y **Account Settings: Read**. Con dominio propio, sumá **Zone: Workers Routes: Edit**, **DNS: Edit** y **Zone: Read** sobre ese dominio.

El **Account ID** está en la portada de Workers & Pages (columna de la derecha).

### 3. Environment de GitHub (o `.env.production`)

Si vas a publicar solo desde tu compu, podés saltear GitHub y poner todo en `.env.production` (ver "Publicar desde tu compu"). Conviene cargarlo igual en GitHub para cuando vuelvan los minutos de Actions.

En el repo, **Settings > Environments > New environment**: `production`. Ahí van los secretos y variables de abajo. Guardá una copia de cada secreto en un gestor de contraseñas: GitHub no deja volver a verlos.

### 4. Recursos de Cloudflare

Con `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y la URL de la base ya cargados (`DATABASE_URL` en GitHub, `PROD_DATABASE_URL` en `.env.production`): **Actions > Cloudflare setup > Run workflow**, o desde tu compu `pnpm deploy:setup`. Al terminar muestra el `HYPERDRIVE_ID`: cargalo como variable del environment (y en `.env.production` si publicás desde tu compu).

### 5. Servicios externos

Con la dirección `https://guaranix.<tu-subdominio>.workers.dev`:

- **Turnstile** (Cloudflare > Turnstile > Add widget): modo "Managed", hostname `guaranix.<tu-subdominio>.workers.dev`. Da la site key y la secret key.
- **Google** (ver "Configurar Google" en el `README.md`): origen JavaScript autorizado `https://guaranix.<tu-subdominio>.workers.dev` y URI de redireccionamiento `https://guaranix.<tu-subdominio>.workers.dev/api/auth/google/callback`. Mientras la pantalla de consentimiento esté en modo prueba, solo pueden entrar los emails que agregues como usuarios de prueba (hasta 100), que alcanza para el piloto.
- **Resend**: creá una API key. Ver "Sin dominio propio".
- Push, Telegram y WhatsApp son opcionales: [`docs/notificaciones.md`](notificaciones.md).

### Sin dominio propio

- **Emails**: Resend solo manda a cualquier dirección desde un dominio verificado. Sin dominio, `EMAIL_FROM` = `GuaraniX <onboarding@resend.dev>` y los emails llegan **solo a tu propia cuenta de Resend**. "Olvidé mi contraseña" no le llega a los alumnos ni a los staff hasta que haya dominio: que entren con Google o que no se olviden la contraseña. Un dominio `.com` cuesta unos USD 10 por año en Cloudflare Registrar.
- **Links de "Olvidé mi contraseña"** abren `/reset-password` en la app del alumno. La contraseña es la misma para las tres apps, así que después se entra al panel normalmente.

### 6. Primer deploy y primer login

1. **Actions > Deploy production > Run workflow**, o desde tu compu `pnpm deploy:production`. La primera vez la dirección puede tardar un minuto; la prueba de humo reintenta.
2. Entrá a `/plataforma/` con Google, usando el email de `PLATFORM_ADMIN_EMAIL`.
3. Creá el primer box y probá el flujo completo.

## Secretos y variables

En el environment `production` de GitHub. Los **secretos** no se pueden volver a ver; las **variables** sí (son valores públicos o ids). El deploy sube a la API solo los nombres de esta lista; el token de Cloudflare y la URL de la base nunca llegan al Worker.

### Del deploy

| Nombre                  | Tipo     | Qué es                                                                                                                                                                              |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | secreto  | Token del paso 2                                                                                                                                                                    |
| `CLOUDFLARE_ACCOUNT_ID` | variable | Id de la cuenta de Cloudflare                                                                                                                                                       |
| `DATABASE_URL`          | secreto  | Connection string **directa** de Neon (sin `-pooler`), con `?sslmode=require`. La usan las migraciones y Hyperdrive. En `.env.production` y en la nube se llama `PROD_DATABASE_URL` |
| `HYPERDRIVE_ID`         | variable | Lo muestra el workflow Cloudflare setup                                                                                                                                             |
| `PLATFORM_ADMIN_EMAIL`  | variable | Tu email: el bootstrap lo deja como superadmin                                                                                                                                      |
| `PUBLIC_URL`            | variable | Opcional. Solo con dominio propio (por ejemplo `https://app.guaranix.com.py`); sin ella se usa workers.dev                                                                          |

### De la API (obligatorios: sin ellos el deploy falla)

| Nombre                 | Tipo     | Cómo se consigue                                                                                              |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`          | secreto  | `openssl rand -base64 48`. **Si cambia, todas las contraseñas dejan de andar**                                |
| `TURNSTILE_SITE_KEY`   | variable | Widget de Turnstile                                                                                           |
| `TURNSTILE_SECRET_KEY` | secreto  | Mismo widget                                                                                                  |
| `GOOGLE_CLIENT_ID`     | variable | Cliente OAuth de Google                                                                                       |
| `GOOGLE_CLIENT_SECRET` | secreto  | Mismo cliente                                                                                                 |
| `RESEND_API_KEY`       | secreto  | Resend > API Keys (permiso "Sending access")                                                                  |
| `EMAIL_FROM`           | variable | Sin dominio: `GuaraniX <onboarding@resend.dev>`. Con dominio verificado: `GuaraniX <no-responder@tu-dominio>` |

### De la API (opcionales: cada uno prende una función)

| Nombre                     | Tipo     | Para qué                                                                                                                                                                    |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_SECRETS_KEY`           | secreto  | IA. `openssl rand -base64 32`. Si cambia, hay que cargar de nuevo las claves de IA                                                                                          |
| `PAYMENTS_SECRETS_KEY`     | secreto  | Cobro con tarjeta: cifra las claves privadas de Bancard de cada box. `openssl rand -base64 32`, distinta de `AI_SECRETS_KEY`. Si cambia, cada box carga de nuevo sus claves |
| `VAPID_PUBLIC_KEY`         | variable | Push (`pnpm --filter @guaranix/messaging vapid:generate`)                                                                                                                   |
| `VAPID_PRIVATE_KEY`        | secreto  | Push                                                                                                                                                                        |
| `VAPID_SUBJECT`            | secreto  | Push: `mailto:` con tu email                                                                                                                                                |
| `TELEGRAM_BOT_TOKEN`       | secreto  | Telegram                                                                                                                                                                    |
| `TELEGRAM_BOT_USERNAME`    | variable | Telegram, sin `@`                                                                                                                                                           |
| `TELEGRAM_WEBHOOK_SECRET`  | secreto  | Telegram: `openssl rand -hex 32`                                                                                                                                            |
| `WHATSAPP_ACCESS_TOKEN`    | secreto  | WhatsApp                                                                                                                                                                    |
| `WHATSAPP_PHONE_NUMBER_ID` | variable | WhatsApp                                                                                                                                                                    |

`APP_ENV` y `WHATSAPP_TEMPLATE_LANGUAGE` no van en GitHub: están en `apps/api/wrangler.jsonc`. Las direcciones las calcula el deploy.

Para sumar un secreto nuevo a la API: agregalo a `Bindings` (`apps/api/src/env.ts`), a la lista de `scripts/deploy/write-secrets-file.mjs` (obligatorio u opcional) y a esta tabla. Sacar uno del environment no lo borra del Worker: los deploys solo agregan o actualizan; para borrarlo, `wrangler secret delete <NOMBRE> --env production`.

## Webhooks externos

Todos entran por la dirección pública, bajo `/api`:

- Telegram: `<dirección>/api/integrations/telegram/webhook` (lo registra el deploy).
- Bancard: `<dirección>/api/webhooks/payments/<accountId>`; el panel del box muestra la URL completa en Ajustes.

## Problemas comunes

- **El deploy dice "not set up yet"**: falta alguno de los cuatro del paso 1 del deploy.
- **"La cuenta de Cloudflare todavía no tiene subdominio workers.dev"**: elegilo en Workers & Pages.
- **"Missing required configuration" en la API**: falta un secreto obligatorio. Revisá la tabla y volvé a publicar.
- **Error 1102 (Worker exceeded resource limits) al entrar o registrarse**: es el límite de CPU del plan gratis. Pasá a Workers Paid.
- **Google dice `redirect_uri_mismatch`**: falta `<dirección>/api/auth/google/callback` en el cliente OAuth.
- **El captcha no aparece o falla**: el hostname no está en el widget de Turnstile.
- **Hyperdrive no conecta**: la `DATABASE_URL` es la "pooled" de Neon o cambió la contraseña. Con una contraseña nueva, editá el Hyperdrive en Cloudflare (**Hyperdrive > guaranix-production > Settings**) además del secreto de GitHub (y de `PROD_DATABASE_URL` donde la tengas).
