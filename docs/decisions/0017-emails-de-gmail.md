# 0017 — Una cuenta por casilla de Gmail

Fecha: 2026-11-28 · Estado: aceptada

## Contexto

En el primer box de producción, el dueño se cargó como `marcos.echague@gmail.com` y Marcos entraba con Google como `marcosechague@gmail.com`. Gmail ignora los puntos y lo que va después de un `+`, así que es la misma casilla, pero GuaraniX las trataba como dos cuentas: el box quedó con un dueño que "nunca entró". Google además puede devolver cualquiera de las dos formas.

## Decisiones

- **Las cuentas se guardan y se buscan en forma canónica** (`canonicalAccountEmail` en `packages/shared`): minúsculas y, para `gmail.com` y `googlemail.com`, sin puntos ni `+etiqueta` en el nombre y con dominio `gmail.com`. Otros proveedores quedan como se escribieron (en minúsculas), porque ahí los puntos o el `+` pueden importar.
- **`accountEmailSchema`** aplica esa forma en registro, login, "Olvidé mi contraseña" y el email del dueño en la Plataforma. El login con Google y `db:bootstrap` (email del superadmin) también la usan. Los emails de contacto (del box o de un alumno) siguen con `emailSchema` y se guardan como se escribieron.
- **La migración 0025** pasa a la forma canónica las cuentas de Gmail que ya existían. Si esa forma ya es de otra cuenta, la vieja queda como estaba: juntar dos cuentas (boxes, fichas de alumno, sesiones) es una decisión a mano. Para un dueño mal cargado se usa "Cambiar dueño" en la Plataforma.
