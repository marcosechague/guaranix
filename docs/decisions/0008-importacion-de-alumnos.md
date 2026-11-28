# 0008 — Importación de alumnos, planes y saldos

Fecha: 2026-11-28 · Estado: propuesta

## Contexto

El PRD promete migrar un box "en un día" desde Excel/CSV o CrossHero: alumnos, planes, planes vigentes con clases restantes y vencimiento, y lo que cada alumno debe. Es una operación masiva que mueve dinero (crea deudas), así que tiene que ser revisable antes, repetible sin duplicar y auditada.

## Decisiones

- **El navegador lee el archivo; la API lee las celdas.** El panel abre el `.xlsx` o `.csv` y manda las filas ya mapeadas a campos, con las celdas como texto. La API las interpreta con las mismas funciones que usa la vista previa (`packages/shared/src/imports`), así lo que se ve es lo que se guarda. El Worker no carga una librería de Excel.
- **Mapeo de columnas sugerido.** `suggestMemberColumns` reconoce encabezados comunes en español (Nombre, Apellido, Cédula, Teléfono, Plan, Vencimiento, Clases restantes, Saldo…) y los que creemos que usa CrossHero (Apellidos, DNI, Tarifa, Fecha fin tarifa, Sesiones restantes). Los de CrossHero salen de su interfaz en español, no de un export real: hay que confirmarlos con el primer box que migre. El usuario siempre puede corregir el mapeo.
- **Celdas como las escribe la gente:** montos `₲ 300.000`, `300.000 Gs`, `300000`; fechas día/mes/año (`31/12/2026`, `31-12-26`), ISO o número de serie de planilla; cédulas con puntos; teléfonos `0981 123 456` → `+595981123456`; tipos de plan "Ilimitado", "3x semana", "Pack 10 clases", "Clase suelta". Un nombre completo en una sola columna se separa (dos nombres si tiene cuatro palabras o más) y se avisa.
- **Vista previa sin escribir** (`POST /box/imports/preview`): cada fila queda `new`, `existing` o `invalid`, con errores y avisos por campo (códigos en `admin.imports.issues`). La importación revisa lo mismo otra vez dentro de su transacción, así una vista previa vieja no puede guardar algo que el box ya no permite.
- **Planes.** Un plan de la fila se busca por nombre (sin mayúsculas ni acentos) entre los del box y los de la hoja "Planes" opcional, que crea los que faltan con las mismas reglas que un plan cargado a mano. Si falta el inicio o el vencimiento, se calcula con la duración del plan. Los packs sin "clases restantes" quedan con todas las del plan (con aviso); más clases que las del plan es error.
- **Dinero.** El plan migrado **no** abre un cargo: ya se pagó en el sistema anterior. El saldo pendiente se guarda como **un cargo abierto** con la descripción que elige el box ("Saldo anterior") y vence el día que diga la planilla o el de la importación; desde ahí aparece en deudores y en el dashboard como cualquier deuda. Montos en guaraníes enteros; negativos o con decimales son error.
- **Repetible sin duplicar.**
  - Mandar las mismas filas otra vez devuelve la primera importación (`replayed: true`) y no crea nada: `data_imports` tiene un hash SHA-256 de las filas, único por box.
  - Un archivo corregido reconoce a los alumnos ya cargados: por id del sistema anterior, por cédula, o por email o teléfono **junto con el nombre** (en familias se comparte el celular). No se cambia su ficha; su plan se agrega solo si no se superpone con uno vigente, y su saldo solo si no se importó antes.
  - Una fila sin cédula, email, teléfono ni id es error: no habría cómo reconocerla la próxima vez. Una cédula que contradice al alumno encontrado también.
- **Con errores no se importa**, salvo que el usuario elija importar solo las filas válidas (`skipInvalidRows`).
- **Auditoría y rastro.** Cada importación queda en `data_imports` (quién, cuándo, archivo, origen y conteos), que la app solo puede insertar y leer. Los alumnos, planes, planes de alumnos y cargos que creó llevan `import_id`, y `audit_logs` registra un `data_import.committed` con el resumen.
- **Permisos y aislamiento.** Solo dueño y admin (`MANAGER_ROLES`). Todo corre en `withBoxScope`: los alumnos y planes con los que se compara son solo los del box, y `import_id` usa clave foránea compuesta con `box_id`.
- **Límites.** Hasta 3.000 alumnos y 200 planes por importación; los inserts van de a 500 filas.

## Pendiente

- Importación asistida con IA (foto, PDF o planilla desordenada) que llena esta misma vista previa, detrás del flag `ai_import`.
- Deshacer una importación reciente (borrar lo que tiene su `import_id` si todavía no tiene reservas ni pagos).
