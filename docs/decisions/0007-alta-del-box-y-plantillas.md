# 0007 — Alta del box en 3 minutos, plantillas por rubro y validación

Fecha: 2026-11-28 · Estado: propuesta

## Contexto

El PRD pide que un box se registre solo en unos 3 minutos, con plantillas paraguayas por rubro y validación antes de guardar (horarios imposibles, precios raros).

## Decisiones

- **Plantillas como datos en `packages/shared/src/onboarding/templates.ts`**, una por rubro (`business_type`): box funcional (CrossFit + Open Box, turnos 6/7/8 y 18/19/20, sábado 8 y 9; ilimitado, 3x y 2x semana, pack de 10, clase suelta, solo Open Box), estudio de pilates (reformer con cupo 6 y mat) y boxeo/artes marciales. Viven en `shared` para que la pantalla las muestre y edite sin pedirlas a la API. `packages/db` las expande a filas (`boxTemplateFromSetup`) y sigue exportando `PARAGUAYAN_BOX_TEMPLATE` para los seeds.
- **El horario se edita como lo piensa el dueño:** una fila por hora con los días en que se repite (`06:00 · lun a vie · 60 min · 16 lugares`), no una fila por clase.
- **Validación compartida (`reviewBoxSetup`)**, la misma en la pantalla y en la API:
  - **Errores** (no se guarda): clase que termina después de medianoche, duración fuera de 15–240 min, cupo de más de 200, la misma hora repetida para el mismo programa y día, programa inexistente, plan sin los límites de su tipo, nombres repetidos, sin horarios o sin planes.
  - **Avisos** (se guarda si el dueño confirma, `acceptWarnings`): clases que se pisan, horarios antes de las 5 o que terminan después de las 23, precio 0, mensual de menos de ₲ 50.000 o clase suelta de menos de ₲ 10.000 ("¿le faltó un cero?"), más de ₲ 3.000.000 ("¿le sobra uno?"), montos que no son redondos, clase suelta más cara que un mensual, plan por semana más caro que el ilimitado, pack con clase más cara que la suelta.
  - La API responde `422 setup_invalid` o `setup_needs_confirmation` con la lista `issues` (código, ruta en el formulario y parámetros) para que la pantalla marque cada problema. Los códigos se traducen en `onboarding.issues`.
- **`POST /onboarding/box`** (cualquier sesión, sin box): crea el box en prueba de 30 días con la persona como dueña, aplica el setup revisado y deja el box activo en la sesión. Usa el plan fundador mientras tenga cupo y después el base. Máximo 3 boxes creados por persona por día. Corre con `createAccountRouter()`: sin aislamiento porque el box todavía no existe, y el servicio solo toca lo que crea. Queda `box.signed_up` en la auditoría, con los avisos que el dueño aceptó. Al final crea las clases de las próximas 2 semanas (con la transacción ya limitada al box nuevo, `enterBoxScope`), para que los alumnos reserven desde el primer día; extenderlas día a día queda para el cron.
- **Reservas desde 24 horas antes por defecto.** `boxes.booking_opens_hours_before` pasa de 168 a 24 (migración 0006): así un alumno no reserva toda la semana de una vez. Cada box lo cambia en el alta o después en sus ajustes. El cupo es por horario y por clase.
- **Pantalla del alta en `apps/admin/src/onboarding/`** (carga aparte, solo la descarga quien todavía no es staff de ningún box): cinco pasos, rubro → datos → horarios → planes → revisión. Elegir el rubro carga una copia de la plantilla. La pantalla corre `reviewBoxSetup` en cada cambio y muestra cada problema debajo de su fila; en la revisión los errores bloquean "Crear mi box" y los avisos piden marcar "Revisé los avisos". El teléfono se normaliza con las mismas reglas que la importación de planillas (`parsePhoneCell`). Al crear, se recarga la sesión y se abre el panel del box nuevo.
