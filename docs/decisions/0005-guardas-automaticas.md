# 0005 — Guardas automáticas de diseño, reuso y seguridad

Fecha: 2026-11-28 · Estado: propuesta

## Contexto

Las reglas de `CLAUDE.md` (textos con `t()`, colores de tokens, sin emojis, reusar `packages/ui`, `box_id` en todo, validar con Zod, nada sensible en logs) se cumplen si alguien se acuerda. Con varias sesiones de Claude trabajando en paralelo, eso no alcanza: las reglas tienen que fallar solas.

## Decisiones

- **Lo mecánico es lint** (`packages/eslint-plugin`, reglas `guaranix/*` con tests). Corre en el editor, en `pnpm lint`, en los hooks y en CI.
  - UI (las tres apps y `packages/ui`): textos visibles fuera de `t()`, emojis, colores a mano, botones de solo ícono sin `aria-label`, archivos de más de 250 líneas, `dangerouslySetInnerHTML`.
  - Solo apps: valores arbitrarios de Tailwind (`w-[13px]`), `<button>`/`<input>` sueltos y `style={…}` (se usa `packages/ui`), Radix importado directo.
  - Servidor: SQL armado con texto, `sql.raw` dinámico, datos sensibles en logs, cookies sin `httpOnly`/`secure`/`sameSite`, rutas fuera de `createBoxRouter()`, `context.req.*` sin Zod, `withSystemScope` fuera de su lista.
  - Las excepciones viven en listas con nombre en `eslint.config.js` (`PUBLIC_ROUTE_FILES`, `RAW_INPUT_FILES`, `SYSTEM_SCOPE_FILES`), así sumar una es una decisión visible en el PR.
- **Lo que mira varios archivos es un script**: `pnpm check:ui` (código copiado con jscpd, clases casi iguales en dos lugares, componentes de una app que pisan uno de `packages/ui`, emojis en `es-PY.json`) y `pnpm check:secrets`.
- **Lo que necesita la pantalla renderizada es un e2e**: `pnpm e2e:layout` (`e2e/tests/layout.spec.ts`) abre las pantallas principales de las tres apps a 390, 834 y 1440 px y falla si hay scroll horizontal, si algo se sale por la derecha sin un contenedor con scroll, o si en tablet y escritorio el contenido del `main` usa menos del 70% del ancho que tiene. Deja las capturas en `.claude/screenshots/layout/`. No corre en el hook porque necesita la base y los servidores; se corre al tocar UI, como `pnpm e2e` (ver "Cómo trabajar" en `CLAUDE.md`).
- **Lo que necesita criterio es un agente**: `ux-reviewer` (jerarquía, espaciado, responsive, accesibilidad, comparado con `docs/design` y con capturas de `pnpm ui:screenshots`) y `security-reviewer` (aislamiento entre boxes, roles, pagos, datos sensibles).
- **Dónde corre:**
  - Claude Code (`.claude/settings.json`): después de cada edición corre los chequeos sobre ese archivo y le devuelve los errores a Claude. Al terminar un turno los vuelve a correr sobre todo lo cambiado y, si cambió bastante UI o código sensible, pide una pasada del agente que corresponda. Pide de nuevo solo si hay archivos nuevos o 40+ líneas más.
  - Git: `pre-commit` (se instala con `pnpm install`) sobre los archivos del commit.
  - CI: lint, `check:ui`, `check:secrets`, y un job de seguridad con `pnpm audit --prod` y gitleaks sobre todo el historial.
- **Rápido y sin ruido.** El chequeo por archivo tarda ~1,5 s. Los umbrales de duplicados ignoran imports y variantes dentro de un mismo componente de `packages/ui`. Un falso positivo se marca en el código con el motivo (`ui-reuse-ignore:`, `secret-scan-ignore:`, `eslint-disable … -- motivo`).
