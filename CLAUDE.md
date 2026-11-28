# GuaraniX — Guía para Claude Code

GuaraniX es un SaaS para boxes de CrossFit, centros de entrenamiento funcional y, más adelante, gimnasios, pilates, artes marciales y entrenadores personales en Paraguay. El producto completo está en `PRD.md`. Leelo antes de empezar cualquier tarea grande.

## Idioma

- **Todo el código en inglés**: nombres de archivos, carpetas, variables, funciones, tipos, tablas y columnas de la base de datos, endpoints, comentarios en el código, mensajes de log, commits, nombres de ramas y descripciones de pull requests.
- **Documentación en español**: `CLAUDE.md`, `PRD.md`, `README.md` y todo lo que esté en `docs/`.
- **Textos que ve el usuario** (botones, mensajes, notificaciones, emails, WhatsApp): en **español de Paraguay** con voseo ("reservá", "pagá", "tenés"), pero **nunca escritos directo en el código**. Van en archivos de traducción (`packages/shared/i18n/es-PY.json`) y el código usa claves en inglés (`t('booking.confirm')`). Así el código queda 100% en inglés y más adelante se puede sumar otro idioma.

---

## Stack

| Capa               | Tecnología                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo           | pnpm workspaces + Turborepo                                                                                                                         |
| Frontend           | React + TypeScript + Vite, como **PWA** (después empaquetada con Capacitor para App Store y Play Store)                                             |
| Estilos            | Tailwind CSS con tokens de diseño propios (ver "Diseño")                                                                                            |
| Componentes        | Librería propia en `packages/ui`, construida sobre Radix UI primitives                                                                              |
| Animaciones        | Motion (framer-motion) — solo animaciones cortas y livianas                                                                                         |
| Estado servidor    | TanStack Query                                                                                                                                      |
| Formularios        | React Hook Form + Zod                                                                                                                               |
| API                | Cloudflare Workers + Hono + TypeScript                                                                                                              |
| Base de datos      | Neon Postgres + Drizzle ORM, conectada vía Cloudflare Hyperdrive                                                                                    |
| Validación         | Zod, con esquemas compartidos entre frontend y API (`packages/shared`)                                                                              |
| Tareas programadas | Cloudflare Cron Triggers (cobros, recordatorios, vencimientos)                                                                                      |
| Colas              | Cloudflare Queues (envío de WhatsApp/Telegram/push, emisión de facturas)                                                                            |
| Archivos           | Cloudflare R2                                                                                                                                       |
| Auth               | Email y contraseña o Google, con Turnstile y "Olvidé mi contraseña" por email (Resend). Sesiones con cookies `HttpOnly` (ver `docs/decisions/0003`) |
| Tests              | Vitest (unitarios), Playwright (end-to-end de flujos críticos)                                                                                      |

### Estructura del repo

```
apps/
  member/      # App del alumno (PWA + Capacitor)
  admin/       # Panel del box (dueño, coaches, recepción) — web responsive
  platform/    # Superadmin (dueño de GuaraniX)
  api/         # Cloudflare Worker (Hono)
packages/
  ui/          # Componentes reutilizables + tokens de diseño
  shared/      # Tipos, esquemas Zod, utilidades (formato de guaraníes, fechas)
  db/          # Esquema Drizzle, migraciones, seeds
  payments/    # Capa de pagos intercambiable (ver "Pagos")
  messaging/   # Push, Telegram, WhatsApp, email detrás de una interfaz común
  ai/          # Proveedores de IA (Anthropic, OpenAI, Gemini) detrás de una interfaz, claves cifradas; después Brodi
```

Los paquetes internos no se compilan: exportan su código TypeScript directo (`"exports": "./src/index.ts"`) y cada app lo empaqueta con Vite o Wrangler.

---

## Reglas de código

- **TypeScript estricto** (`strict: true`, sin `any` salvo justificación en comentario).
- **Funciones y componentes chicos** con una sola responsabilidad. Si un archivo pasa ~250 líneas, dividilo.
- **Nombres descriptivos** en inglés. Nada de abreviaturas crípticas.
- **Lógica de negocio fuera de los componentes y de las rutas**: va en servicios (`apps/api/src/services`) o en `packages/shared`. Las rutas de Hono solo validan, autorizan y llaman servicios.
- **Un esquema Zod por entidad** en `packages/shared`, usado en el formulario del frontend y en la validación de la API.
- **Sin duplicar componentes**: antes de crear uno, buscá en `packages/ui`. Si algo se repite dos veces, extraelo.
- **Comentarios solo para el "por qué"**, no para el "qué".
- **Tests** para toda lógica de dinero, permisos, créditos/planes y facturación. Sin tests ahí, no se mergea.
- **Migraciones de base de datos** siempre con Drizzle Kit, nunca cambios manuales.
- Commits chicos y descriptivos (Conventional Commits: `feat:`, `fix:`, `refactor:`…).

---

## Diseño

Objetivo: **verse claramente más moderno y cuidado que CrossHero**, en celular y en web.

Las pantallas de referencia están en `docs/design/` (ver su `README.md`).

Cada pantalla se arma con `Page` (layout `mobile`, `panel` o `centered`), `PageHeader` y `Card` de `packages/ui`, así las tres apps comparten anchos, márgenes y jerarquía.

### Identidad

- Marca: **GuaraniX**. Asistente/mascota: **Brodi** (una pesa rusa con vincha, entrenada y simpática). Imagen en `packages/ui/src/assets/` (componente `<Brodi />`); original en `docs/brand/`.
- **Logo y logo en letras: pendientes**, van a ser distintos de Brodi. Brodi es el asistente, **nunca el logo**. Mientras tanto se usa `<GuaranixLogo />` de `packages/ui`, que hoy es solo el nombre en Space Grotesk. Cuando llegue el logo definitivo se cambia solo ese componente.
- Colores base (tokens en `packages/ui/src/tokens`, expuestos a Tailwind en `packages/ui/src/styles/theme.css`):
  - Fondo oscuro `#0E0F11`, superficie `#17181B`, borde `#2A2C30`
  - Texto `#F4F5F2`, texto secundario `#A3A69E`
  - Acento lima `#D9F24A` (acción principal, estados activos)
  - Éxito `#6EE7A0`, alerta `#FF8A5B`
  - Modo claro y oscuro con los mismos tokens (`data-theme` en `<html>`). La app del alumno y el panel del box siguen al sistema y cada usuario puede elegir en Perfil/Cuenta o con el botón del menú (`useTheme`, `ThemePicker`, `ThemeToggleButton` en `packages/ui`). Platform sigue en claro.
- Tipografía: **Space Grotesk** para títulos y números grandes, **Inter** para texto.
- Cada box puede cambiar el color de acento y subir su logo (white-label liviano).

### Principios

- **Mobile first** en la app del alumno; **responsive** en admin y platform (funciona en celular, tablet y escritorio).
- Jerarquía clara: lo más importante de cada pantalla arriba y grande (próxima clase, WOD, cuota).
- Mínimo de clics: reservar en 2 toques, cargar un resultado en 1 pantalla.
- Estados vacíos útiles (que digan qué hacer), nunca pantallas en blanco con un ícono gigante.
- Esqueletos de carga (skeletons), no spinners en pantalla completa.
- Íconos de línea consistentes (Lucide). **Sin emojis en la interfaz.**

### Animaciones

- **Finas, cortas y livianas**: 150–250 ms, curvas `ease-out`.
- Solo propiedades baratas: `transform` y `opacity`. Nada de animar `width`, `height` o `box-shadow` en listas.
- Usos: transición entre pantallas, aparición de tarjetas, feedback al tocar botones, celebración al lograr un PR (confeti breve con Brodi).
- **Respetar `prefers-reduced-motion`**: si el usuario lo pide, sin animaciones.
- Nada que bloquee la interacción ni que dure más de 400 ms.

### Accesibilidad

- Contraste mínimo 4.5:1 en texto.
- Áreas táctiles de al menos 44×44 px.
- Elementos interactivos reales (`button`, `a`, `input` con `label`), navegables con teclado.
- `aria-label` en botones de solo ícono.

### Rendimiento

- La app del alumno tiene que abrir rápido con 3G y en celulares de gama baja.
- Code splitting por ruta, imágenes optimizadas, fuentes con `font-display: swap`.
- **Offline**: el WOD del día, el timer y la próxima reserva funcionan sin conexión (service worker + cache). La app del alumno usa `AuthProvider offline` y `ApiProvider offlineQueries` (solo WOD, clases, reservas y planes; nunca la ficha del alumno); los datos guardados se borran al cerrar sesión (ver `docs/decisions/0010`).

---

## Seguridad

Manejamos datos personales y dinero de terceros. La seguridad no es opcional.

- **Multi-tenant estricto**: toda tabla de datos de un centro tiene `box_id`. Toda consulta filtra por el `box_id` de la sesión. Agregá tests que prueben que un box **no puede** ver datos de otro.
- **Autorización por rol** en cada endpoint: `platform_admin`, `box_owner`, `box_admin`, `coach`, `reception`, `member`. Por defecto, denegar. Toda ruta privada pasa por `authGate` (`apps/api/src/middleware/auth-gate.ts`); las rutas de un box se arman con `createBoxRouter()`, que exige los roles permitidos y corre el pedido dentro de `withBoxScope` con el `box_id` de la sesión. Las del superadmin (`/platform/*`) se arman con `createPlatformRouter()`, que exige `is_platform_admin` y audita todo cambio a un box (ver `docs/decisions/0006`).
- **Validar toda entrada** con Zod en la API, aunque el frontend ya valide.
- **Nunca guardar datos de tarjeta.** Solo tokens del proveedor de pagos.
- **Webhooks de pagos**: verificar firma, ser idempotentes (no cobrar ni marcar pagado dos veces), registrar cada evento.
- **Secretos** solo en variables de entorno de Cloudflare (`wrangler secret`). Nunca en el código ni en el repo.
- **Cookies** `HttpOnly`, `Secure`, `SameSite=Lax`. Protección CSRF en formularios.
- **Rate limiting** en login, envío de códigos y endpoints públicos.
- **Logs sin datos sensibles** (sin cédulas completas, tokens ni códigos de acceso).
- **Auditoría**: registrar quién cambió precios, planes, pagos, permisos o datos de alumnos.
- **Brodi (IA)**: solo puede ejecutar acciones con los mismos permisos que el usuario que le habla, nunca más. Toda acción que mueve dinero o borra datos pide confirmación explícita.
- Dependencias actualizadas; revisar `pnpm audit` antes de cada release.

---

## Pagos

Contexto: en noviembre de 2026 cayó ueno Bank y con él uPay (ex Pagopar). **No dependemos de un solo proveedor.**

- `packages/payments` define una interfaz común (`PaymentProvider`): crear cliente, guardar tarjeta (token), cobrar, reembolsar, procesar webhook.
- Primer proveedor: **Bancard**. Segundo: el que se defina (ej. Dinelco). Agregar uno nuevo no debe requerir cambios fuera de ese paquete.
- Cada box conecta **su propia cuenta** del proveedor. El dinero va directo al box; GuaraniX no retiene fondos.
- Medios manuales siempre disponibles: QR/transferencia (con comprobante) y efectivo registrado por recepción.
- Todo monto en **guaraníes enteros** (`integer`, sin decimales). Formato de pantalla: `₲ 300.000` (usá `formatGuarani` de `packages/shared`).

---

## Mantenibilidad

- Cada integración externa (pagos, WhatsApp, Telegram, SIFEN, IA) detrás de una interfaz propia, con su adaptador. Así se cambia o se testea con mocks.
- Feature flags por box y por plan (ej. `ai_import`, `sifen`, `whatsapp`, `branded_app`), configurables desde el superadmin: `platform_plan_features` y `box_feature_overrides`, con `assertFeatureAvailable()` en la API (ver `docs/decisions/0009`).
- Configuración en datos, no en código: planes, precios y límites se editan desde el superadmin.
- Documentar decisiones importantes en `docs/decisions/` (un archivo corto por decisión).
- Mantener este `CLAUDE.md` actualizado cuando cambie algo de arquitectura.

---

## Desarrollo local

- Requisitos: Node 22+, pnpm (vía `corepack enable`) y Docker.
- `cp .env.example .env`, `pnpm install` y `pnpm db:up` (Postgres 17 en Docker). Detalles en `README.md`.
- La base local reemplaza a Neon + Hyperdrive solo en desarrollo; nunca apuntes `.env` a la base de producción.

---

## Cómo trabajar

1. Antes de una tarea grande, proponé un plan corto y esperá confirmación.
2. Construí por partes: esquema de datos → API con tests → UI.
3. Reutilizá componentes de `packages/ui`; si falta uno, crealo ahí.
4. Al terminar, corré lint, typecheck y tests (`pnpm lint && pnpm typecheck && pnpm test`).

### Guardas automáticas

Las reglas de diseño, reuso y seguridad de este archivo están automatizadas (detalle en `docs/decisions/0005`):

- `pnpm lint` incluye las reglas `guaranix/*` (`packages/eslint-plugin`); `pnpm check:ui` busca código y estilos repetidos; `pnpm check:secrets` busca secretos.
- Los hooks de `.claude/settings.json` corren esos chequeos después de cada edición y antes de terminar. Si te devuelven errores, arreglalos; no los saltees.
- Cuando el hook de Stop lo pida, corré los agentes `ux-reviewer` y/o `security-reviewer` (`.claude/agents/`) y aplicá lo bloqueante.
- Para ver una pantalla: `pnpm ui:screenshots <member|admin|platform|all>` (capturas en celular, tablet y escritorio).
- Para levantar una excepción, sumá el archivo a la lista que corresponde en `eslint.config.js` o dejá el comentario con el motivo; que quede visible en el PR.
