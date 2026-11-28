# 0013 — Qué ve cada rol de un alumno y protecciones de la cuenta

Decidido por Marcos después de la revisión previa al piloto (`docs/revision-pre-piloto.md`).

## Datos del alumno

- **Coach**: ve la ficha (contacto, contacto de emergencia, notas médicas, notas del box, planes y marcas), pero **no la cédula ni lo que paga**. La API le devuelve `documentNumber: null` y `priceGs: null` en los planes, y no puede buscar por cédula (si pudiera, la adivinaría buscando). Cobros y pagos ya eran solo para recepción y administración.
- **Alumno**: las "Notas" de su ficha son internas del box. `GET /box/me` le devuelve `notes: null`. En "Mi cuota" ve solo las notas de los pagos que él mismo informó, nunca las que escribió el staff, ni quién registró o revisó cada pago.
- La regla vive en los servicios (`memberForViewer` en `services/members.ts`, `listMemberPlans`, `ownAccount`), así cualquier ruta nueva que los use la respeta.

## "Entrar como"

- Cada ficha de alumno que abre soporte se registra como `support.member_viewed`. Solo la ve el superadmin, en la actividad del box; el box no se entera (ver `0006`).

## Cuenta

- **Primera contraseña en una cuenta de Google**: como no hay contraseña actual para confirmar, se pide un ingreso con Google de los últimos 10 minutos (`recent_sign_in_required`). La pantalla de Cuenta ofrece "Volver a ingresar con Google". Así una sesión olvidada abierta no puede sumar una forma permanente de entrar. Ingresar de nuevo con Google desde el mismo navegador cierra la sesión anterior de ese navegador.
- **Cerrar sesión** desvincula el push de ese navegador: la app cancela la suscripción y manda el endpoint en `POST /auth/logout` (`{ pushEndpoint }`, opcional), y la API lo borra en la misma operación. Los demás dispositivos siguen recibiendo avisos.

## Pendiente

- Ocultar en el registro si un email ya tiene cuenta queda como está hasta tener dominio propio para mandar un mail por cada alta.
