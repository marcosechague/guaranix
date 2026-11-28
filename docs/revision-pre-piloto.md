# Revisión antes del piloto

Fecha: 2026-11-28 · Alcance: todo lo hecho en la Fase 0 hasta el PR #42 (seguridad, código, diseño y tests end-to-end). `packages/payments` (Bancard) y el deploy los revisaron sus propios hilos; acá solo aparecen donde se cruzan.

**En resumen:** la base está bien hecha. El aislamiento entre boxes es fuerte (Row Level Security en Postgres más `box_id` de la sesión en cada ruta, con tests), toda ruta privada pasa por sesión, CSRF y roles, y toda entrada se valida con Zod. No encontré ninguna forma de que un box vea datos de otro. Lo que apareció fueron filtraciones chicas dentro de un mismo box, límites que se podían saltear y estados de pantalla engañosos. Lo urgente ya está arreglado y mergeado.

## Qué encontré y qué arreglé

### Alta

| Hallazgo                                                                                                                                                     | Estado                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| "Entrar como" un box daba al superadmin todos los permisos del dueño: podía registrar pagos, cambiar precios y borrar.                                       | **Arreglado (#34).** Ahora es solo lectura, bloqueado en el servidor para toda ruta del box, con tests. El aviso lo dice. |
| La API arrancaba en modo desarrollo con un `wrangler deploy` común: sin captcha, cookie sin `Secure` y links de "Olvidé mi contraseña" impresos en los logs. | **Arreglado** por el hilo de deploy (#35): producción por defecto, `staging` y `production` explícitos.                   |

### Media

| Hallazgo                                                                                                                                                 | Estado                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Los alumnos recibían las **notas para coaches** del WOD ("los alumnos no las ven") y quedaban guardadas en el celular.                                   | **Arreglado (#36).**                                                                    |
| El límite mensual de lecturas con IA se podía saltear mandando varios pedidos a la vez (cada uno gasta en la clave de GuaraniX).                         | **Arreglado (#36):** bloqueo por box y máximo 5 lecturas por minuto por persona.        |
| Después de cambiar la contraseña por "Olvidé mi contraseña", quien había tenido la sesión seguía recibiendo los avisos por Telegram o push.              | **Arreglado (#36):** el reset borra los Telegram y navegadores vinculados.              |
| "Entrar como" abría el alta de box ("Creá tu box") en vez del panel.                                                                                     | **Arreglado (#40).**                                                                    |
| En modo claro (panel y plataforma) **no se veía el foco del teclado** ni las barras de cupo, puntos y switches: el lima casi no contrasta con el blanco. | **Arreglado (#39):** nuevo color `accent-strong` con contraste probado.                 |
| El WOD no cargaba nunca sin conexión: el resultado esperaba a la pizarra, que offline no llega.                                                          | **Arreglado (#39).**                                                                    |
| Si fallaba un pedido, varias pantallas mostraban un estado vacío falso, por ejemplo **"Nadie debe cuotas. Buen trabajo."** en Inicio.                    | **Arreglado (#39)** en deudores, próxima clase, indicadores, cuota y planes del alumno. |

### Baja

| Hallazgo                                                                                     | Estado                                                                   |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| En la pizarra cada alumno veía las notas privadas de los resultados de los demás.            | **Arreglado (#36).**                                                     |
| Sin límite de tamaño en los pedidos: un pedido de 100 MB a `/auth/login` llenaba la memoria. | **Arreglado (#36):** 128 KB, 12 MB para importaciones.                   |
| Las suscripciones push aceptaban cualquier URL y sin tope.                                   | **Arreglado (#36):** solo servicios push de navegadores, 10 por persona. |
| Las apps web no mandaban cabeceras de seguridad (clickjacking en el panel).                  | **Arreglado** por el hilo de deploy (#37).                               |
| Chips y selectores de 36–40 px (mínimo 44). La plataforma ofrecía "Creá una cuenta".         | **Arreglado (#39).**                                                     |
| Tests de la API que fallaban a veces en CI por tiempo de arranque de la base en memoria.     | **Arreglado (#36).**                                                     |

## Tests end-to-end

Nuevos en `e2e/` con Playwright, en CI en cada pull request (#43): login, alta del box en 5 pasos, reservar y cancelar, lista de espera, cargar el resultado del WOD, informar un pago con comprobante y que recepción lo confirme, importar alumnos desde una planilla, y "entrar como" en solo lectura. Cómo correrlos: `README.md`, "Tests end-to-end".

## Lo que queda y necesita tu decisión

1. **¿Qué ve un coach de cada alumno?** Hoy ve la ficha completa: cédula, email, teléfono, contacto de emergencia, notas médicas, notas internas y **cuánto pagó cada uno** (con descuentos). Recomiendo que vea nombre, notas médicas y si el plan está al día, sin cédula ni precios.
2. **Las "Notas" de la ficha del alumno, ¿son internas?** El alumno las recibe en su perfil (`GET /box/me`), y en "Mi cuota" ve las notas que recepción dejó en sus pagos. Si son internas, hay que dejar de mandarlas. Recomiendo separarlas: notas internas (solo staff) y notas para el alumno.
3. **Crear la primera contraseña en una cuenta de Google** no pide volver a ingresar. Alguien con una sesión abierta en la PC de recepción podría sumarse una contraseña. Recomiendo pedir un ingreso con Google reciente y avisar por email.
4. **Cerrar sesión no desvincula el push de ese navegador.** En una tablet compartida el alumno siguiente recibe los avisos del anterior hasta que se suscribe él. Recomiendo desvincularlo al cerrar sesión (no lo hice porque cambia lo que espera alguien que cierra sesión en su propio celular).
5. **"Entrar como" audita la entrada y la salida, no lo que se mira.** Si querés registrar qué fichas abrió soporte, es un cambio aparte.
6. **Cuentas existentes se pueden adivinar**: el alta responde "ese email ya está registrado" y "Olvidé mi contraseña" tarda distinto si la cuenta existe. El captcha y los límites lo frenan. Se puede responder siempre igual, a costa de un mensaje menos claro al registrarse.

## Mejoras que no bloquean el piloto

Diseño:

- Las tres apps resuelven distinto el menú (activo en lima, negro o verde suave) y la barra del celular. Conviene un solo `AppSidebar` y `TabBar` en `packages/ui`.
- Esqueletos de carga duplicados entre panel y plataforma, y dos tablas distintas (Alumnos no usa `DataTable`).
- Títulos de tarjetas copiados ~20 veces: conviene un `CardTitle`.
- Estados vacíos sueltos que no dicen qué hacer ("Sin planes todavía.").
- La pantalla de login es correcta pero sobria: es la primera impresión en las tres apps. Vale una vuelta con Brodi y el logo cuando llegue.
- "Importar 1 filas": falta el singular en algunos textos con cantidad.
- Montos grandes en los indicadores pueden no entrar en celulares chicos (₲ 12.500.000).

Código:

- Poca duplicación (0,2 %, `jscpd`). Archivos de más de 250 líneas: `jobs/card-autopay.ts` (413, del hilo de pagos), `shared/api/types.ts` (338) y `services/workout-results.ts` (262).
- La app del alumno calcula lo que debe y lo que está en revisión (`apps/member/src/lib/fees.ts`) a partir de los cargos y pagos. Es lógica de dinero en el frontend: mejor que la API devuelva esos totales.
- `routes/box.ts` consulta la base directo en la ruta (`/box/current`); debería pasar por un servicio.
- Turnstile no verifica el `hostname` de la respuesta.
