# Pantallas de referencia

Maquetas estáticas que definen el estilo visual de GuaraniX. No son código de producción: sirven para copiar jerarquía, espaciados y colores al construir cada pantalla con los componentes de `packages/ui`.

| Archivo | Pantalla | App |
|---|---|---|
| `Main.html` | Inicio del alumno | member |
| `Reservar.html` | Reservar clase | member |
| `Wod.html` | WOD y resultado | member |
| `WodGuiado.html` | Modo WOD guiado | member |
| `Cuota.html` | Mi cuota | member |
| `AdminBox.html` | Admin del box | admin |
| `Dueno.html` | Panel del dueño (celular) | admin |
| `Plataforma.html` | Admin de la plataforma (modo claro) | platform |

Notas:

- Las maquetas usan plantillas (`{{accent}}`, `<sc-for>`) y un `support.js` que no vino en el export, así que abiertas en el navegador algunas partes se ven incompletas.
- Los colores de las maquetas ya están cargados como tokens en `packages/ui/src/tokens/colors.ts`.
