# 0010 — Comprobantes de pago en R2

## Contexto

Los pagos por transferencia y QR necesitan un comprobante. El esquema ya guardaba `receipt_file_key`, pero no había dónde subir el archivo, así que recepción no podía registrar pagos por QR.

## Decisión

- Los comprobantes van a un bucket **privado** de R2 (`RECEIPTS`, `guaranix-receipts`). Nunca hay links públicos: el archivo se pide a la API (`GET /box/receipts/<clave>`) con la sesión, y el panel lo muestra como un `blob:` local.
- La clave es `boxes/<box_id>/receipts/<user_id>/<uuid>.<ext>`. El box y quien lo subió quedan en la clave, así que:
  - recepción, administradores y dueño abren cualquier comprobante de **su** box;
  - un alumno abre y adjunta solo los que subió él;
  - los coaches no manejan plata: no suben ni abren comprobantes;
  - una clave de otro box, de otra persona o con `..` responde lo mismo que un archivo que no existe (404).
- `POST /box/receipts` recibe el archivo como cuerpo crudo. El tipo se decide por los primeros bytes (JPG, PNG, WebP o PDF), no por el `Content-Type` que manda el navegador, y el tamaño máximo es 5 MB. Al servirlo, la respuesta lleva `nosniff` y una CSP `sandbox`, para que un archivo nunca corra como página.
- `recordPayment` rechaza una clave que el usuario no podría abrir, así nadie adjunta el comprobante de otro.
- R2 queda detrás de `FileStorage` (`apps/api/src/integrations/file-storage.ts`); los tests usan una versión en memoria. `wrangler dev` simula el bucket en local, y `pnpm db:seed` le pone un comprobante de ejemplo a las transferencias de la demo (`demo:receipts`).

## Pendiente

- La pantalla del alumno para informar una transferencia o un QR con su comprobante (la API ya lo permite).
- Borrar comprobantes de pagos rechazados después de un tiempo.
