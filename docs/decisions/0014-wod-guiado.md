# 0014 — Modo WOD guiado

## Contexto

El PRD (Fase 1) pide que la app use la estructura del WOD para guiar al alumno: peso sugerido antes, ejercicio actual durante (tocando la pantalla para avanzar) y resultado precompletado después. Hasta ahora cada parte del WOD tenía solo una descripción en texto libre.

## Decisión

- Cada parte (`workout_components`) suma dos columnas opcionales:
  - `guided_steps` (`jsonb`, `{ quantity, name }[]`): los pasos que recorre el modo guiado ("21" + "Thrusters").
  - `load_percent` (1–150): el peso sugerido como % de la mejor marca del alumno en `movement_id`. Sin movimiento no hay sugerencia (lo exige un `check`).
- Si el coach no cargó pasos, la app los **lee de la descripción**, una línea por movimiento, con esquemas tipo "21-15-9" y "5 rondas" (`parseGuidedSteps`, `guidedPlanFor` en `packages/shared/src/guided`). Así los WODs ya cargados también se pueden guiar.
- Cómo avanza cada tipo: For time, cada toque marca el paso y muestra el siguiente (los pasos se repiten por ronda); AMRAP, cada toque suma una ronda; EMOM y Tabata, el reloj cambia de ejercicio solo.
- Peso sugerido: la "mejor marca" es el 1RM si existe, si no el mayor peso cargado en ese movimiento. Se redondea **hacia abajo** a múltiplos de 2,5 kg (lo seguro es sugerir un poco menos) y los botones + y − mueven de a 2,5 kg.
- El resultado de una parte basada en un movimiento guarda también el peso usado (`load_grams`), aunque se puntúe por tiempo o rondas. Ese peso no cuenta como PR: no es un esfuerzo máximo.

**App del alumno** (`/wod/guiado/:componentId`, botón "Modo guiado" en cada parte que se puede guiar):

- Pantalla completa y oscura, como el timer, y reusa su reloj (`useWorkoutTimer`), sonidos, vibración y Wake Lock. El avance (paso, rondas, peso elegido) se guarda en `localStorage` por parte, así un recargo no pierde nada.
- El centro de la pantalla es **un solo botón**: tocar en cualquier parte avanza. "Deshacer" y "Pausar" quedan afuera, para no tocarlos sin querer.
- Al terminar se abre el resultado ya cargado (tiempo o rondas y el peso usado) con la misma `ResultCard` del WOD; solo queda elegir Rx o Escalado y guardar. Si es PR, festeja Brodi.
- **Offline**: el WOD ya estaba en el cache del teléfono; ahora también la lista de movimientos (solo nombres del box). Las marcas del alumno **no** se guardan offline (son datos personales), así que sin conexión y sin haberlas cargado antes no hay sugerencia y el alumno elige el peso con + y −.

## Pendiente

- Cargar un 1RM a mano desde la app (hoy la marca sale de los resultados de fuerza).
- PR por tiempo en benchmarks (ej. "Fran 41 s más rápido").
