# GuaraniX

Software de gestión y app para boxes y centros de entrenamiento funcional en Paraguay. El producto está descrito en [`PRD.md`](./PRD.md) y las reglas de trabajo en [`CLAUDE.md`](./CLAUDE.md).

## Estructura

| Carpeta                                | Qué es                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/member`                          | App del alumno (PWA, modo oscuro) — puerto 5173                               |
| `apps/admin`                           | Panel del box (modo claro) — puerto 5174                                      |
| `apps/platform`                        | Superadmin de GuaraniX (modo claro) — puerto 5175                             |
| `apps/api`                             | API en Cloudflare Workers + Hono — puerto 8787                                |
| `packages/ui`                          | Tokens de diseño, tema de Tailwind, componentes y Brodi                       |
| `packages/shared`                      | Traducciones (`i18n/es-PY.json`), formato de guaraníes y esquemas compartidos |
| `packages/db`                          | Esquema Drizzle, migraciones y conexión a Postgres                            |
| `packages/payments`, `messaging`, `ai` | Reservados para los próximos pasos                                            |

## Desarrollo local

Necesitás **Node 22+**, **pnpm** (`corepack enable`) y **Docker**.

```bash
cp .env.example .env        # variables locales (sin secretos reales)
pnpm install
pnpm db:up                  # levanta Postgres 17 en Docker y espera a que esté listo
pnpm db:check               # confirma que llegás a la base
pnpm db:migrate             # aplica las migraciones de Drizzle
pnpm db:seed                # crea un box demo con la plantilla paraguaya
cp apps/api/.dev.vars.example apps/api/.dev.vars   # variables de la API (ajustá el puerto de la base)
pnpm dev                    # levanta las 3 apps y la API en paralelo
```

Después abrí http://localhost:5173 (alumno), http://localhost:5174 (box), http://localhost:5175 (plataforma) y http://localhost:8787/health (API).

Para levantar una sola app: `pnpm --filter @guaranix/member dev`.

### Login

En desarrollo el login anda sin cuentas externas: sin captcha, sin botón de Google, y los emails de "Olvidé mi contraseña" se imprimen en la terminal de la API (`[dev email] ...`) con el link para abrir. Los usuarios del seed no tienen contraseña: entrá a http://localhost:5174, tocá "Olvidé mi contraseña" con `owner@box-demo-asuncion.local` y abrí el link de la terminal. O creá una cuenta nueva desde "Creá una".

El seed también crea un alumno de muestra, `alumno@box-demo-asuncion.local` (Daniel Rojas), con plan, reservas, resultados en la pizarra y PRs: activalo igual, con "Olvidé mi contraseña" desde http://localhost:5173.

Para probar Turnstile, descomentá las claves de prueba en `apps/api/.dev.vars`. Para Google, seguí los pasos de abajo.

#### Configurar Google (una vez)

1. En [Google Cloud Console](https://console.cloud.google.com/), creá un proyecto (por ejemplo "GuaraniX").
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo "Externo", nombre GuaraniX, email de soporte, y los alcances `openid`, `email` y `profile`. Mientras esté en modo prueba, agregá tu email como usuario de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth**, tipo "Aplicación web".
4. **URIs de redireccionamiento autorizados**: `http://localhost:8787/auth/google/callback` para desarrollo y `https://<dominio-de-la-api>/auth/google/callback` para producción.
5. Copiá el ID y el secreto a `apps/api/.dev.vars` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). En Cloudflare: `wrangler secret put GOOGLE_CLIENT_ID` y `wrangler secret put GOOGLE_CLIENT_SECRET`.

#### Producción

En staging y producción la API no arranca si falta alguna de estas: `AUTH_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` y `EMAIL_FROM` (un remitente verificado en Resend). Además, `ALLOWED_ORIGINS` con los dominios de las apps y `PUBLIC_API_URL` con el de la API. Detalles en `docs/decisions/0003-login-y-sesiones.md`.

### Base de datos

| Comando                       | Qué hace                                                                 |
| ----------------------------- | ------------------------------------------------------------------------ |
| `pnpm db:up` / `pnpm db:down` | Prende o apaga Postgres (los datos se guardan en un volumen de Docker)   |
| `pnpm db:reset`               | Borra la base local y la vuelve a crear vacía                            |
| `pnpm db:generate`            | Genera una migración a partir de los cambios en `packages/db/src/schema` |
| `pnpm db:migrate`             | Aplica las migraciones pendientes                                        |
| `pnpm db:seed`                | Carga planes de GuaraniX, un admin y un box demo con alumnos y clases    |
| `pnpm db:studio`              | Abre Drizzle Studio para mirar los datos                                 |

Si el puerto 5432 está ocupado, cambiá `POSTGRES_PORT` y el puerto de `DATABASE_URL` en `.env`.

## Calidad

```bash
pnpm lint        # ESLint
pnpm typecheck   # TypeScript estricto en todos los paquetes
pnpm test        # Vitest
pnpm format      # Prettier
```

GitHub Actions corre lint, typecheck, tests y build en cada pull request.
