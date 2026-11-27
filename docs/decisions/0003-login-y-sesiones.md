# 0003 — Login, sesiones y autorización

Fecha: 2026-11-27 · Estado: propuesta

## Contexto

`CLAUDE.md` planteaba login sin contraseña con un código por email o WhatsApp. Cada login mandaría un mensaje, y eso cuesta. Marcos prefirió email y contraseña más Google, con "Olvidé mi contraseña" como único email que se manda, y captcha.

## Decisiones

- **Dos formas de entrar:** email y contraseña, o "Continuar con Google" (OpenID Connect con PKCE, `state` y `nonce`). Desde "Seguridad de tu cuenta" se vincula Google o se crea una contraseña, según con qué entró la persona. No se puede desvincular Google si es la única forma de entrar.
- **Contraseñas:** PBKDF2-SHA256 con 100.000 iteraciones, sal propia y un _pepper_ (`AUTH_SECRET`). Cloudflare Workers no acepta más iteraciones en WebCrypto, y Argon2 o scrypt necesitan WebAssembly compilado en tiempo de ejecución, que Workers no permite. El _pepper_ hace que un volcado de la base no alcance para crackear contraseñas. El formato guarda los parámetros, así que se pueden subir después. Cambiar `AUTH_SECRET` invalida todas las contraseñas (cada uno usaría "Olvidé mi contraseña"). Política: 8 a 128 caracteres, sin reglas de composición (NIST 800-63B).
- **El hash vive aparte**, en `user_credentials`, porque el staff de un box puede leer `users` de su box.
- **Email verificado:** se marca cuando la persona usa un link de recuperación o entra con Google. Si alguien registró un email ajeno con contraseña y después el dueño real entra con Google, se borra esa contraseña y se cierran sus sesiones (_pre-account hijacking_).
- **Registro abierto:** cualquiera puede crear cuenta; queda sin box hasta que un box lo agregue. El registro dice "ya hay una cuenta con ese email": evitarlo exigiría mandar un email en cada registro. Captcha y rate limiting lo frenan.
- **Recuperación:** token de 256 bits, se guarda solo su SHA-256, vence en 30 minutos, sirve una vez y el pedido nuevo invalida los anteriores. Al usarlo se cierran todas las sesiones. La respuesta es igual exista o no la cuenta.
- **Sesiones:** cookie `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-gx_session` (en desarrollo `gx_session` sin `Secure`, porque Safari no acepta cookies `Secure` en `http://localhost`). En la base solo el SHA-256 del token. Duran 30 días; cambiar la contraseña cierra las demás.
- **CSRF:** toda escritura necesita un `Origin` de la lista (`ALLOWED_ORIGINS`), lo que también frena el _login CSRF_. Con sesión, además, el header `X-CSRF-Token`, que es un HMAC del token de sesión (no hay que guardarlo).
- **Captcha:** Cloudflare Turnstile (gratis) en registro, login y recuperación, detrás de `CaptchaVerifier`. Google no lleva captcha: ya lo protege Google.
- **Rate limiting** en Postgres (`rate_limit_counters`, ventana fija). Las claves son HMAC de la IP o el email, así que la tabla no guarda datos personales. Límites: login 30 por IP y 10 por email cada 15 min; registro 10 por IP por hora; recuperación 10 por IP y 3 por email por hora.
- **Desarrollo sin cuentas externas:** sin claves de Turnstile, Google o Resend, el login funciona igual, sin captcha, sin botón de Google y con los emails impresos en la terminal de `wrangler dev`. En staging y producción faltar cualquiera de esas claves corta todos los pedidos (falla cerrado).
- **Email:** Resend detrás de `EmailSender` en `packages/messaging`.
- **Autorización:** `authGate` deniega por defecto; solo las rutas de `PUBLIC_ROUTES` andan sin sesión. Las rutas de un box se arman con `createBoxRouter()`, que exige la lista de roles de cada ruta (si falta, no compila), toma el `box_id` de la sesión y corre el pedido dentro de `withBoxScope`. Una respuesta de error deshace la transacción.
- **Tablas de login sin acceso desde un box:** política `deny_app_role` y `REVOKE ALL` para `guaranix_app`. Solo el servicio de auth las toca con `withSystemScope`.

## Pendiente

- Limpiar `rate_limit_counters`, sesiones vencidas y tokens usados con un Cron Trigger.
- Primer login de alumnos importados (Excel, CrossHero): hoy necesitan un usuario creado por el box y entran con "Olvidé mi contraseña" o Google.
- Elegir box cuando la persona está en varios (la API ya tiene `POST /auth/session/box`; falta la pantalla).
- WhatsApp como canal de recuperación, cuando haya proveedor.
