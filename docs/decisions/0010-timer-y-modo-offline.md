# 0010 — Timer del WOD y modo offline de la app del alumno

## Contexto

El PRD pide que el WOD del día, el timer y la próxima reserva funcionen sin conexión. En muchos boxes la señal es mala, y el alumno usa el timer en el piso, con el celular lejos.

## Decisión

**Timer**

- La lógica es pura y vive en `packages/shared/src/timer` (`timerPlanFor`, `timerSnapshot`, `timerCue`), con tests. Así el modo TV y el WOD guiado la pueden reusar.
- El reloj se calcula con la hora del sistema (`Date.now()`), no sumando ticks: no se atrasa si el navegador frena la pestaña, y el estado se guarda en `localStorage` por parte del WOD, así sobrevive a un recargo.
- Cuenta regresiva de 10 s antes de arrancar. Beeps generados con Web Audio (sin archivos), vibración y Wake Lock mientras corre.
- Pantalla `/wod/timer/:componentId`, fuera del layout con menú, siempre oscura (`data-theme="dark"`) para leerse de lejos.
- Al terminar, "Cargar resultado" abre el WOD con el tiempo (For time) o las rondas (AMRAP) ya cargados.

**Offline**

- El service worker de `vite-plugin-pwa` (generateSW) precachea la app y responde las navegaciones con `index.html`, así la app abre sin red.
- Los datos no los cachea el service worker: `ApiProvider offline` guarda la última respuesta buena de cada consulta de TanStack Query en `localStorage` (máx. 7 días) y la restaura antes del primer render. Primero se ve lo guardado y, con red, se actualiza.
- La clave incluye usuario y box, y **todo se borra al cerrar sesión** (`clearOfflineData`).
- `AuthProvider offline` guarda la última sesión (sin el token CSRF) y la usa solo si falla la red, nunca si la API responde 401. No es una credencial: la cookie `HttpOnly` sigue autorizando cada pedido. Al volver la red se pide la sesión real.
- `OfflineNotice` avisa "Sin conexión" y de cuándo son los datos que se ven.

## Por qué no cachear la API en el service worker

Las respuestas son por persona, con cookie, desde otro origen. Cachearlas en Cache Storage hace difícil borrarlas al salir y mezclar cuentas en un celular compartido. Con TanStack Query el control queda en el código de la app y se testea.
