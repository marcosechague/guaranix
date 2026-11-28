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
cp apps/api/.dev.vars.example apps/api/.dev.vars   # variables de la API
pnpm db:seed                # crea un box demo y les pone contraseña a las cuentas demo
pnpm dev                    # levanta las 3 apps y la API en paralelo
```

Después abrí http://localhost:5173 (alumno), http://localhost:5174 (box), http://localhost:5175 (plataforma) y http://localhost:8787/health (API).

Para levantar una sola app: `pnpm --filter @guaranix/member dev`.

### Login

En desarrollo el login anda sin cuentas externas: sin captcha, sin botón de Google, y los emails de "Olvidé mi contraseña" se imprimen en la terminal de la API (`[dev email] ...`) con el link para abrir.

`pnpm db:seed` deja estas cuentas listas, todas con la contraseña `guaranix-demo-2026`:

| Cuenta                              | Rol                    | Dónde entrar                       |
| ----------------------------------- | ---------------------- | ---------------------------------- |
| `owner@box-demo-asuncion.local`     | Dueño del box          | http://localhost:5174 (box)        |
| `coach@box-demo-asuncion.local`     | Coach                  | http://localhost:5174 (box)        |
| `recepcion@box-demo-asuncion.local` | Recepción              | http://localhost:5174 (box)        |
| `alumno@box-demo-asuncion.local`    | Alumno (Daniel Rojas)  | http://localhost:5173 (alumno)     |
| `admin@guaranix.local`              | Superadmin de GuaraniX | http://localhost:5175 (plataforma) |

La contraseña la pone `apps/api/scripts/demo-passwords.ts` con el `AUTH_SECRET` de `apps/api/.dev.vars`, y se niega a correr si `DATABASE_URL` no apunta a `localhost`: nunca llega a staging ni a producción. Si cambiás `AUTH_SECRET`, corré `pnpm --filter @guaranix/api demo:passwords` otra vez.

Para probar Turnstile, descomentá las claves de prueba en `apps/api/.dev.vars`. Para Google, seguí los pasos de abajo.

#### Configurar Google (una vez)

1. En [Google Cloud Console](https://console.cloud.google.com/), creá un proyecto (por ejemplo "GuaraniX").
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo "Externo", nombre GuaraniX, email de soporte, y los alcances `openid`, `email` y `profile`. Mientras esté en modo prueba, agregá tu email como usuario de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth**, tipo "Aplicación web".
4. **URIs de redireccionamiento autorizados**: `http://localhost:8787/auth/google/callback` para desarrollo y `https://<dominio-de-la-api>/auth/google/callback` para producción.
5. Copiá el ID y el secreto a `apps/api/.dev.vars` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). En staging y producción van en el environment de GitHub (ver `docs/despliegue.md`).

#### Producción

En staging y producción la API no arranca si falta alguna de estas: `AUTH_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` y `EMAIL_FROM` (un remitente verificado en Resend). Además, `ALLOWED_ORIGINS` con los dominios de las apps y `PUBLIC_API_URL` con el de la API. Detalles en `docs/decisions/0003-login-y-sesiones.md`.

## Despliegue

Staging se publica solo cuando un cambio llega a `main` con CI en verde; producción, con un tag `v*`. Cloudflare (Workers, Hyperdrive, R2, Queues) y Neon, con los secretos en los environments de GitHub. Configuración inicial, secretos y cómo volver atrás: [`docs/despliegue.md`](docs/despliegue.md).

### Base de datos

| Comando                       | Qué hace                                                                 |
| ----------------------------- | ------------------------------------------------------------------------ |
| `pnpm db:up` / `pnpm db:down` | Prende o apaga Postgres (los datos se guardan en un volumen de Docker)   |
| `pnpm db:reset`               | Borra la base local y la vuelve a crear vacía                            |
| `pnpm db:generate`            | Genera una migración a partir de los cambios en `packages/db/src/schema` |
| `pnpm db:migrate`             | Aplica las migraciones pendientes                                        |
| `pnpm db:seed`                | Carga planes de GuaraniX, un admin y un box demo con alumnos y clases    |
| `pnpm db:studio`              | Abre Drizzle Studio para mirar los datos                                 |

Postgres de Docker escucha en el puerto `54329` (no en 5432), así no choca con otro Postgres que tengas instalado. Si lo cambiás, cambiá `POSTGRES_PORT` y el puerto de `DATABASE_URL` en `.env` y en `apps/api/.dev.vars`.

## Calidad

```bash
pnpm lint        # ESLint
pnpm typecheck   # TypeScript estricto en todos los paquetes
pnpm test        # Vitest
pnpm format      # Prettier
```

GitHub Actions corre lint, typecheck, tests y build en cada pull request.
