# 0016 — Modos de asistencia configurables por box

Fecha: 2026-11-28 · Estado: en construcción

## Contexto

Con el check-in con QR en la entrada (0014) quedó una duda: no todos los boxes tienen alguien en la puerta ni quieren una tablet. Algunos prefieren que el coach tome lista y otros un QR pegado en la pared. Marcos decidió que el box elija cualquier combinación desde Ajustes.

## Decisiones

- **Tres modos, cada uno con su interruptor en `boxes`**: `check_in_desk_enabled` (tablet o celular de recepción que lee el QR del alumno, 0014), `check_in_coach_enabled` (el coach marca desde la lista de la clase) y `check_in_wall_qr_enabled` (el alumno escanea un cartel impreso). Un box nuevo arranca solo con la lista del coach; la tablet de la entrada, el QR de pared y la llegada del staff se prenden en Ajustes. Los boxes que ya existían y marcaron asistencia desde que salió la entrada (28/11/2026) la mantienen prendida.
- **Se cambian en Ajustes → Asistencia**, solo el dueño o un administrador, y queda en la auditoría (`box.check_in_policy_updated`). `GET /box/current` devuelve `checkInModes` para que las apps escondan lo que el box no usa (el menú "Entrada" y el botón "Mostrar mi QR").
- **Un modo apagado se rechaza en la API**, no solo se esconde: `check_in_mode_disabled`.
- **Cada sede tiene su ubicación** (`locations.latitude` y `longitude`, las dos o ninguna). Se carga con "Usar mi ubicación actual" parado en la sede o copiando los números de un mapa.
- **El QR de pared exige estar cerca**: la distancia máxima a la sede es `check_in_radius_meters` (150 m por defecto, entre 30 y 1000). Además tiene que ser durante el horario de la clase y una sola vez por alumno y clase, así una foto del cartel mandada por WhatsApp no sirve desde afuera del box. Si el alumno no da permiso de ubicación o el GPS no alcanza, la app le dice que le avise al coach.
- **La lista del coach** usa las mismas reglas que la entrada: se puede marcar desde un rato antes de que empiece la clase, muestra los avisos de plan y cuota vencida, y permite sumar a quien llegó sin reserva si hay lugar.
