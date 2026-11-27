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
pnpm dev                    # levanta las 3 apps y la API en paralelo
```

Después abrí http://localhost:5173 (alumno), http://localhost:5174 (box), http://localhost:5175 (plataforma) y http://localhost:8787/health (API).

Para levantar una sola app: `pnpm --filter @guaranix/member dev`.

### Base de datos

| Comando                       | Qué hace                                                                 |
| ----------------------------- | ------------------------------------------------------------------------ |
| `pnpm db:up` / `pnpm db:down` | Prende o apaga Postgres (los datos se guardan en un volumen de Docker)   |
| `pnpm db:reset`               | Borra la base local y la vuelve a crear vacía                            |
| `pnpm db:generate`            | Genera una migración a partir de los cambios en `packages/db/src/schema` |
| `pnpm db:migrate`             | Aplica las migraciones pendientes                                        |
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
