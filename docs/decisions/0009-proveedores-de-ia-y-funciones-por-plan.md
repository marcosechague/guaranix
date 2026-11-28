# 0009 — Proveedores de IA, claves y funciones por plan

Fecha: 2026-11-28 · Estado: propuesta

## Contexto

La importación con IA (y después Brodi) necesita leer fotos, PDF y planillas desordenadas con un modelo de lenguaje. No queremos atarnos a un proveedor (la caída de uPay nos enseñó eso con los pagos), las claves de API son secretos de GuaraniX y el costo por uso es real, así que tiene que poder venderse como extra de un plan y limitarse por mes.

## Decisiones

- **Una interfaz, tres adaptadores** (`packages/ai`). `AiProvider.extract()` recibe instrucciones fijas, partes (texto, imagen o PDF en base64) y un JSON Schema, y devuelve el JSON, los tokens usados y el modelo que respondió. Hay adaptadores para Anthropic (SDK oficial, con streaming y _fallbacks_ del servidor en los modelos que los aceptan), OpenAI (Chat Completions con `json_schema` estricto) y Gemini (`generateContent` con `responseJsonSchema`). OpenAI y Gemini van con `fetch` para no agrandar el Worker. Sumar un proveedor es un adaptador más y un valor en `AI_PROVIDERS`.
- **Respuestas validadas.** `extractStructured()` arma el schema desde Zod (todos los campos obligatorios y objetos cerrados, lo que exige OpenAI y aceptan los demás) y vuelve a validar la respuesta con Zod: un modelo puede equivocarse aunque tenga schema.
- **Errores neutrales.** Cada adaptador traduce lo que falla a `AiProviderError` (`auth`, `rate_limited`, `unavailable`, `bad_request`, `refused`, `truncated`, `invalid_output`). El mensaje nunca lleva la clave ni datos del usuario, y el cuerpo de error del proveedor se descarta. La API los muestra como `ai_key_rejected`, `ai_unavailable`, etc.
- **Proveedor y modelo son datos.** Una sola fila en `ai_settings`, editable desde el superadmin (pantalla IA). El modelo es texto libre (sugerimos `claude-opus-5-5` para Anthropic) y el botón "Probar conexión" hace un pedido mínimo para confirmar clave y modelo.
- **Claves cifradas, nunca en claro.** `ai_provider_keys` guarda cada clave cifrada con AES-256-GCM bajo `AI_SECRETS_KEY`, un secreto del Worker (`wrangler secret put AI_SECRETS_KEY`, 32 bytes en base64). El nombre del proveedor va como dato asociado, así un cifrado copiado a otra fila no abre. Solo se guarda y se muestra el final (`…c3d4`); la clave no vuelve a salir de la API, no se loguea y la auditoría registra el proveedor y ese final. Sin `AI_SECRETS_KEY` no se pueden guardar ni usar claves (la pantalla lo avisa). Cambiar la clave maestra obliga a cargar las claves de nuevo.
- **Fuera del alcance de los boxes.** `ai_settings` y `ai_provider_keys` tienen los permisos revocados para `guaranix_app` y una política que niega todo, como las tablas de login. El runtime de IA las lee con `withSystemScope` y descifra la clave en memoria solo para ese pedido.
- **Funciones por plan y por box.** `platform_plan_features` dice qué extras incluye cada plan de GuaraniX y cuántos usos por mes (vacío = sin límite); los boxes la leen pero no la escriben. `box_feature_overrides` guarda una decisión de la plataforma para un box (activar en una prueba, apagar por abuso, otro límite); vacío en un campo es "como dice su plan". Las dos se editan desde el superadmin y quedan auditadas; el cambio de un box también aparece en su historial.
- **Límites por mes del box.** Cada pedido a un proveedor deja una fila en `ai_usage` (box, usuario, función, proveedor, modelo, tokens), que el box puede insertar pero no editar ni borrar. `assertFeatureAvailable()` cuenta las del mes calendario en la zona horaria del box y corta con `feature_limit_reached` al llegar al límite. Un uso cuenta aunque el usuario descarte el resultado: el costo ya se pagó.
- **Primera función: `ai_import`.** El seed la incluye en el plan fundador con 10 usos por mes solo como ejemplo; qué planes la incluyen se decide en el superadmin.

## Pendiente

- La importación con IA en sí (pantalla y endpoint), que usa esta capa y llena la misma vista previa de `0008`.
- Brodi, con sus propios límites sobre `ai_usage`.
- Mostrar el costo estimado por box a partir de los tokens guardados.
