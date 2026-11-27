# 0001 — Base del monorepo

Fecha: 2026-11-27 · Estado: aceptada

## Contexto

Arrancamos GuaraniX desde un repo vacío con el stack definido en `CLAUDE.md`.

## Decisiones

- **Paquetes internos sin compilar.** `packages/*` exportan TypeScript directo; Vite y Wrangler los empaquetan. Menos configuración y sin pasos de build intermedios.
- **Tailwind CSS v4.** Los tokens viven en `packages/ui/src/tokens` (TypeScript) y en `packages/ui/src/styles/theme.css` (variables CSS + `@theme`). Un test verifica que ambos coincidan y que los pares de texto cumplan contraste 4.5:1.
- **Tema por atributo.** `data-theme="dark"` (alumno) y `data-theme="light"` (admin y plataforma). El acento es una variable CSS (`--gx-color-accent`) para que cada box pueda cambiarlo sin recompilar.
- **Fuentes self-hosted** con Fontsource (Inter y Space Grotesk variables), para que el service worker las guarde y funcionen offline.
- **TypeScript 6.0** en lugar de 7.0: `typescript-eslint` todavía no soporta 7. Revisar cuando lo soporte.
- **Postgres 17 en Docker** para desarrollo local. En producción se usa Neon vía Hyperdrive; el cliente (`postgres.js` + Drizzle) es el mismo en los dos casos.
- **Brodi** se recortó del fondo blanco original y se guarda en PNG y WebP de 512 px; el original queda en `docs/brand/`.
