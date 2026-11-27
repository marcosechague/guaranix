# GuaraniX — Documento de producto (PRD)

## 1. Visión

Software de gestión y app para boxes de CrossFit y centros de entrenamiento en Paraguay. **Todo lo que hace CrossHero, mejor diseñado, más barato y hecho para Paraguay**: cobro automático con medios locales, factura electrónica SIFEN, comunicación por WhatsApp/Telegram, todo en guaraníes, y un asistente con IA llamado Brodi.

- Arranque comercial: boxes de CrossFit y funcional en Gran Asunción, Encarnación y Ciudad del Este.
- Producto preparado desde el inicio para otros rubros (pilates, yoga, boxeo, artes marciales, gimnasios, entrenadores personales) mediante módulos por rubro.
- No usar la palabra "CrossFit" en la marca: es marca registrada. Decir "boxes y entrenamiento funcional".

## 2. Usuarios y aplicaciones

| App                                | Usuario                           | Plataforma                                 |
| ---------------------------------- | --------------------------------- | ------------------------------------------ |
| **App del alumno** (`apps/member`) | Alumnos                           | PWA → App Store / Play Store con Capacitor |
| **Admin del box** (`apps/admin`)   | Dueño, admins, coaches, recepción | Web responsive (celular y escritorio)      |
| **Plataforma** (`apps/platform`)   | Dueño de GuaraniX (superadmin)    | Web                                        |

Roles: `platform_admin`, `box_owner`, `box_admin`, `coach`, `reception`, `member`.

## 3. Brodi, el asistente

Mascota: pesa rusa negra con vincha y musculosa lima, entrenada pero simpática. Aparece en la app, en el panel y en los mensajes.

- **Para el dueño/coach** (en el panel, por WhatsApp o Telegram): consultas en lenguaje natural ("¿cuánto cobré este mes?", "¿quién no viene hace 10 días?"), acciones con confirmación ("cancelá la clase del feriado", "publicá este WOD"), resumen semanal, foto de la pizarra → WOD digital.
- **Para el alumno**: reservar por chat ("Brodi, reservame mañana a las 7"), consultar deuda, recibir link de pago.
- Incluido en todos los planes con límite de uso; uso ilimitado como extra.
- Mismos permisos que el usuario. Nunca más.

## 4. Alcance por fases

### Fase 0 — MVP para pilotos (6–8 semanas)

Objetivo: 3–5 boxes de Asunción usándolo gratis.

**Plataforma (superadmin)**

- Alta/baja de centros, planes de GuaraniX, suspender/reactivar, "entrar como" un box (con auditoría).
- Métricas: MRR, boxes activos/en prueba, costo de infraestructura.

**Admin del box**

- Registro en 3 minutos con **plantillas paraguayas** por rubro (ej. box típico: CrossFit + Open Box, turnos 6/7/8/18/19/20, plan ilimitado, 3x semana, clase suelta, precios de referencia en ₲).
- Validación antes de guardar (horarios imposibles, precios raros).
- **Migración**: importar alumnos, planes y saldos desde Excel/CSV o CrossHero en un día.
- Alumnos, planes (ilimitado / N por semana / packs / clase suelta), pausas.
- Horarios, programas, coaches, cupos, lista de espera, cancelación tardía y ausencias.
- WODs por componentes (calentamiento, fuerza, metcon), con tipo de puntuación y timer.
- Cobros manuales (efectivo, transferencia, QR con comprobante) y lista de deudores.
- Dashboard: cobrado, pendiente, alumnos activos, altas/bajas, ocupación.
- Roles y permisos.

**App del alumno**

- Login con código de 6 dígitos (email/WhatsApp).
- Inicio: próxima clase, WOD del día, racha, estado de la cuota.
- Reservar en 2 toques, lista de espera, cancelar.
- WOD con timer integrado (For time, AMRAP, EMOM, Tabata), funciona offline.
- Cargar resultado (Rx/Escalado), PRs, pizarra del día con "fist bumps".
- Mi cuota: plan, vencimiento, historial de pagos.
- Notificaciones push.

**Mensajería**

- Push (gratis) para reservas, WOD y avisos.
- Telegram (gratis) para avisos internos de dueño/coaches.
- WhatsApp para recordatorios de cuota (con cupo por plan).

### Fase 1 — v1 comercial (+6 semanas)

- **Cobro automático con Bancard** (tarjeta tokenizada, débito recurrente, reintentos, link de pago por WhatsApp si falla). Capa de pagos intercambiable.
- Check-in con QR (tablet/celular en la entrada): solo entran los que tienen la cuota al día; asistencia real.
- Multi-sede: un panel, un alumno, pase entre sedes, reportes por sede.
- Porcentajes automáticos del 1RM en el WOD.
- Medallas y hitos automáticos (rachas, 100 clases, aniversario, primer PR).
- Brodi v1 para el dueño (consultas + resumen semanal).
- Alertas de abandono (asistencia que baja) con botón de WhatsApp.
- Modo TV del box (WOD, timer y pizarra en pantalla grande).
- **Modo WOD guiado**: la app usa la estructura del WOD que cargó el coach para guiar al alumno.
  - Antes: muestra el WOD y sugiere el peso según su 1RM; un toque para confirmar o cambiar.
  - Durante: pantalla oscura a pantalla completa con timer y ejercicio actual. **Tocar en cualquier parte** marca el bloque/ronda terminado y avanza solo. En AMRAP cada toque suma una ronda. Pantalla siempre encendida (Wake Lock), vibración y sonido al avanzar.
  - Después: pantalla de resultado precompletada (tiempo, rondas, peso, Rx/Escalado); solo confirmar. Si es PR, celebración con Brodi y tarjeta para Instagram.
  - Funciona offline.

### Fase 2 — diferencial (+2 meses)

- **Factura electrónica SIFEN** automática al cobrar (RUC/cédula, IVA 10%, timbrado). Vía proveedor autorizado.
- Brodi v2: acciones con confirmación, por WhatsApp/Telegram, también para alumnos.
- **Carga de resultado por voz**: "terminé en 9:42 con 30 kilos" → Brodi completa el resultado (reconocimiento de voz del dispositivo + IA para interpretar).
- App con marca propia del box en las tiendas (extra pago).
- Integraciones TuPase y Wellhub (validación de visitas por QR).
- Tarjetas para Instagram (PR, resultado del WOD) con logo del box.
- Landing page simple por box con reserva de clase de prueba.

### Más adelante (no ahora)

- Competencias internas y throwdowns entre boxes (definir antes cómo validar resultados).
- Ranking nacional.
- Tienda con comisión, pases de clase suelta para visitantes.
- Experimento: detección automática de repeticiones con cámara o reloj inteligente (poco confiable en un box hoy; evaluar más adelante).
- Módulos de otros rubros: reserva por máquina (pilates), cinturones (artes marciales), rutinas (gimnasio).

## 5. Precios

| Concepto                                                         | Precio                                      |
| ---------------------------------------------------------------- | ------------------------------------------- |
| Plan base (alumnos ilimitados, todo el núcleo, Brodi con límite) | **₲ 199.000 / mes**                         |
| Precio fundador (primeros 15–20 centros, de por vida)            | **₲ 169.000 / mes**                         |
| Sede adicional                                                   | ₲ 99.000 / mes                              |
| Factura SIFEN                                                    | extra (a definir según costo del proveedor) |
| App con marca propia                                             | extra                                       |
| Paquete WhatsApp adicional / Brodi ilimitado                     | extra                                       |
| Pago anual                                                       | 2 meses gratis                              |
| Prueba                                                           | 30 días gratis, migración incluida          |

Referencia: CrossHero cobra ₲ 350.000 por mes **por sede** en Paraguay.

## 6. Arquitectura y costos

Ver `CLAUDE.md` para stack y reglas. Costo estimado al arrancar: US$ 20–60/mes de infraestructura + contador. Comisiones de pago a cargo de cada box (cuenta propia del proveedor).

## 7. Métricas de éxito

- Tiempo de alta de un box: < 10 minutos.
- % de cuotas cobradas a tiempo por box (meta: > 90%).
- Alumnos que abren la app al menos 3 veces por semana.
- Bajas de boxes por mes (meta: < 3%).

## 8. Riesgos

- Caída de un proveedor de pagos (ya pasó con uPay) → capa de pagos intercambiable + medios manuales.
- Mercado chico de boxes → producto multi-rubro desde el diseño.
- Costo de WhatsApp e IA → límites por plan, push y Telegram como canales gratis.
- Datos personales → seguridad multi-tenant, auditoría, términos y política de privacidad revisados por un profesional local.
