# 0012 — Despliegue en Cloudflare

## Contexto

La fase 0 andaba solo en local. Para el piloto con los primeros 3 a 5 boxes hace falta publicarla de forma repetible, sin pasos a mano que alguien se olvide, y con un ambiente de pruebas que no toque datos reales.

## Decisión

- **Dos ambientes con `env` de Wrangler** (`staging`, `production`) en cada `wrangler.jsonc`. El nivel de arriba sigue siendo desarrollo local. Wrangler no hereda bindings ni vars, así que cada ambiente los lista completos.
- **Apps como Workers de archivos estáticos** (`assets` con `not_found_handling: single-page-application`), no Pages: misma herramienta, mismo deploy y custom domains iguales a los de la API.
- **Un solo dominio, subdominios por app** (`app`, `panel`, `plataforma`, `api`, con `-staging` para pruebas). La cookie `__Host-` con `SameSite=Lax` necesita que app y API sean el mismo sitio; `workers.dev` queda apagado. Los subdominios de un solo nivel entran en el certificado universal de Cloudflare.
- **Dos proyectos de Neon**, no ramas del mismo: staging nunca hereda datos personales de producción. Región São Paulo.
- **GitHub Environments como única fuente de secretos.** El deploy los pasa con `wrangler deploy --secrets-file`, filtrados por una lista de nombres permitidos. Así se configuran en un solo lugar, quedan versionados con el código que los usa, y el token de Cloudflare y la URL de la base nunca llegan al Worker.
- **Ids de la cuenta fuera del repo.** El `HYPERDRIVE_ID` es una variable de GitHub que el deploy reemplaza en `wrangler.jsonc`; los recursos los crea un workflow idempotente (`cloudflare-setup.yml`) por la API de Cloudflare.
- **Orden del deploy**: migraciones → bootstrap (planes y superadmin, idempotente) → API → apps → prueba de humo. Las migraciones van primero y tienen que ser compatibles con la versión anterior del código.
- **Staging automático** cuando CI pasa en `main`; **producción a mano** (tag `v*` o "Run workflow"), con aprobación opcional en el environment.
- Si un environment no está configurado, el deploy avisa y termina sin error, para que `main` no quede en rojo mientras tanto.

## Consecuencias

- Cambiar el dominio toca cinco archivos; `pnpm check:deploy` (en CI) avisa si quedan distintos.
- Un secreto nuevo de la API se suma en `env.ts`, en `scripts/deploy/write-secrets-file.mjs` y en `docs/despliegue.md`.
- Los deploys no borran secretos del Worker: sacar uno es un `wrangler secret delete` a mano.
- Runbook completo en `docs/despliegue.md`.

## Actualización: un solo ambiente y la dirección gratis de Cloudflare

Para arrancar el piloto sin pagar dominio, Marcos decidió publicar solo **producción** y en `workers.dev`.

- `workers.dev` es un sufijo público: dos Workers ahí son sitios distintos y la cookie `SameSite=Lax` no viaja entre ellos. Por eso un Worker **gateway** (`apps/gateway`) sirve las tres apps en una sola dirección (`/`, `/panel/`, `/plataforma/`) y pasa `/api/*` a la API por _service binding_. La API no tiene dirección pública propia.
- Las direcciones que la API necesita (`ALLOWED_ORIGINS`, `PUBLIC_API_URL`, `ADMIN_APP_URL`, `MEMBER_APP_URL`) se calculan en el deploy a partir de `PUBLIC_URL` o del subdominio workers.dev de la cuenta, y se pasan con `--var`. Pasar a un dominio propio es cambiar una variable.
- Los archivos los sirve el asset store sin correr el Worker; el gateway solo corre para `/api/*` y para las rutas de las apps.
- Mergear a `main` ya no publica: producción sale con un tag `v*` o a mano. Staging se puede volver a sumar copiando `env.production`.
- El service worker del alumno (scope `/`) ignora `/panel`, `/plataforma` y `/api` en la navegación offline.
