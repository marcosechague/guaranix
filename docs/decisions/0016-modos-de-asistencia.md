# 0016 — Modos de asistencia configurables por box

Fecha: 2026-11-28 · Estado: aceptada

## Contexto

Con el check-in con QR en la entrada (0014) quedó una duda: no todos los boxes tienen alguien en la puerta ni quieren una tablet. Algunos prefieren que el coach tome lista y otros un QR pegado en la pared. Marcos decidió que el box elija cualquier combinación desde Ajustes.

## Decisiones

- **Tres modos, cada uno con su interruptor en `boxes`**: `check_in_desk_enabled` (tablet o celular de recepción que lee el QR del alumno, 0014), `check_in_coach_enabled` (el coach marca desde la lista de la clase) y `check_in_wall_qr_enabled` (el alumno escanea un cartel impreso). Un box nuevo arranca solo con la lista del coach; la tablet de la entrada, el QR de pared y la llegada del staff se prenden en Ajustes. Los boxes que ya existían y marcaron asistencia desde que salió la entrada (28/11/2026) la mantienen prendida.
- **Se cambian en Ajustes → Asistencia**, solo el dueño o un administrador, y queda en la auditoría (`box.check_in_policy_updated`). `GET /box/current` devuelve `checkInModes` para que las apps escondan lo que el box no usa (el menú "Entrada" y el botón "Mostrar mi QR").
- **Un modo apagado se rechaza en la API**, no solo se esconde: `check_in_mode_disabled`.
- **Cada sede tiene su ubicación** (`locations.latitude` y `longitude`, las dos o ninguna). Se carga con "Usar mi ubicación actual" parado en la sede o copiando los números de un mapa.
- **El QR de pared exige estar cerca**: la distancia máxima a la sede es `check_in_radius_meters` (150 m por defecto, entre 30 y 1000). Además tiene que ser durante el horario de la clase y una sola vez por alumno y clase, así una foto del cartel mandada por WhatsApp no sirve desde afuera del box. Si el alumno no da permiso de ubicación o el GPS no alcanza, la app le dice que le avise al coach.
- **La lista del coach** usa las mismas reglas que la entrada: se puede marcar desde un rato antes de que empiece la clase, muestra los avisos de plan y cuota vencida, y permite sumar a quien llegó sin reserva si hay lugar.

## Lista del coach

- Las reglas compartidas viven en `apps/api/src/services/admission.ts`: ventana (desde 30 minutos antes hasta que termina la clase), alumno activo, cuota al día y plan que cubra la clase.
- "Vino" se marca desde 30 minutos antes. "Faltó" solo cuando la clase ya empezó.
- La lista muestra a cada alumno con lo que diría la entrada ("Debe ₲ …", "Dado de baja"). El coach decide igual, porque la persona ya está en el box.
- "Sumar a alguien que vino sin reservar" (`POST /box/classes/:id/walk-ins`) aplica las mismas reglas que la entrada: si no puede, no escribe nada y dice por qué. A diferencia de la entrada, también funciona con la clase ya empezada.
- Con la lista del coach apagada en Ajustes, el coach y recepción no pueden marcar. El dueño y los administradores sí, para corregir.

## QR de la pared

- El cartel se imprime desde Ajustes → Sedes (ícono de impresora, `/panel/cartel/:sede`). Su QR abre la app del alumno en `/pared/w1.<sede>.<HMAC>`. La firma usa `AUTH_SECRET` e incluye el `box_id`, así un cartel de otro box no sirve acá. No vence porque está impreso. Si hay que invalidarlo, se rota el secreto.
- La app pide la ubicación una vez (alta precisión, sin guardarla) y manda `POST /box/me/wall-check-ins { code, latitude, longitude, accuracyMeters }`.
- La API rechaza con un motivo claro: `wall_qr_too_far` si está más lejos que el radio, `wall_qr_inaccurate` si la precisión del GPS es peor que el radio, `wall_qr_location_missing` si la sede no tiene ubicación, `check_in_mode_disabled` si el box no usa este modo y `wall_qr_invalid` si el código está mal. Después aplica las mismas reglas que la entrada, solo con clases de esa sede (`checkInMember`). "Una vez por clase" sale solo: la segunda vez responde que ya estaba presente.
- Si el alumno no da permiso de ubicación o el GPS no alcanza, la pantalla lo explica y le dice que le avise al coach, que lo marca desde la lista.
- Un celular con la ubicación falseada podría engañar al chequeo. Es un riesgo aceptado: alcanza para frenar la foto del cartel mandada por WhatsApp, y el coach ve la lista igual.

## Llegada del staff (opcional)

- Cuarto interruptor, `check_in_staff_enabled`, apagado por defecto. Solo funciona con la tablet de la entrada prendida (el QR se lee ahí), así que en Ajustes aparece debajo de ella y `checkInModes.staff` es falso si la entrada está apagada.
- Coaches, recepción, administradores y el dueño abren "Mi QR de llegada" en el menú del panel (`/panel/mi-qr`, `GET /box/check-ins/staff-pass`). El QR es `gs1.…`, firmado igual que el del alumno (`gx1.…`) pero con otra versión, así uno no sirve como el otro. Vence a los 2 minutos.
- La entrada lo lee con el mismo `POST /box/check-ins` y responde `outcome: "staff_arrived"`. Se guarda una fila por persona y día del box en `staff_arrivals` (la primera lectura; las siguientes muestran la misma hora). Quien ya no está activo en el box recibe `staff_inactive`.
- El dueño y los administradores ven "Llegadas del staff hoy" en el inicio (`GET /box/check-ins/staff-arrivals?date=`). Las filas no se editan ni se borran desde la app.
