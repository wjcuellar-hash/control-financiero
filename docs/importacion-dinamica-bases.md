# Importación dinámica de bases (cartera)

## ¿Qué hace ahora?
El dashboard permite importar una o múltiples bases con estructuras distintas y las adapta al esquema interno automáticamente.

- Detecta tipo de base (`pagos`, `compromisos`, `gestiones`, `demografico`, `estrategias`, `traslados`, `canal_autorizado`, `otras_fuentes`).
- Mapea columnas por aliases hacia el esquema estándar.
- Normaliza campos clave para análisis y cruce.
- Emite logs de lectura, mapeo y cobertura.
- Permite seleccionar una carpeta completa desde UI y procesar automáticamente todos los archivos compatibles.
- Ejecuta un motor de estrategia y priorización por registro al finalizar la normalización.
- Genera bases finales listas para descarga por prioridad y canal sugerido.

## Motor automático de estrategia y priorización
Archivo: `src/js/strategy-engine.js`

### Criterios usados por registro
El motor consolida cada cliente por `npr/nit` y aplica reglas sobre:
- `score` (si existe en la base),
- `saldo_capital`,
- `bucket`,
- `dias_mora`,
- `semaforo`,
- pagos recientes (últimos 45 días),
- compromisos activos,
- canal autorizado,
- estrategia del banco.

### Resultado automático por registro
Cada registro queda con:
- `prioridad`: `P0`, `P1`, `P2`, `P3` o `PB`,
- `canal_sugerido`: `Marcador`, `WhatsApp`, `SMS`, `Email`, `Blaster` o `Manual`,
- `justificacion` corta basada en las reglas disparadas.

### Bases de salida generadas
- `base_priorizada_general`
- `base_marcador`
- `base_whatsapp`
- `base_sms`
- `base_email`
- `base_blaster`
- `base_manual`

Se guardan en `monthData.strategyEngine.outputs` y se pueden descargar vía:

```js
await window.ControlFinanciero.downloadStrategyBase('base_whatsapp')
```

También se puede consultar el paquete completo:

```js
await window.ControlFinanciero.getStrategyOutputs()
```

## Configuración de aliases
Archivo: `src/js/column-aliases.config.js`

### Agregar nuevas variantes de columnas
1. Busca la constante `COLUMN_ALIASES`.
2. Ubica el campo estándar (por ejemplo `telefono`).
3. Agrega el nuevo nombre en el arreglo de aliases, por ejemplo:

```js
telefono: ['telefono', 'celular', 'movil', 'phone', 'telefono_principal']
```

### Agregar nuevos detectores de tipo de base
1. Busca la constante `DATASET_TYPE_RULES`.
2. Agrega el nuevo tipo con palabras señal:

```js
nueva_fuente: ['palabra_clave_1', 'palabra_clave_2']
```

## Uso rápido
- Importación clásica (compatibilidad):
  - `window.ControlFinanciero.importBase(records, { fileName: 'pagos_abril.csv' })`
- Importación múltiple:
  - `window.ControlFinanciero.importBases([{ fileName: 'pagos.csv', records }, { fileName: 'gestiones.csv', records: gestiones }])`
- Importación automática desde carpeta:
  1. Ir a la pestaña **Resumen**.
  2. Clic en **Seleccionar Carpeta**.
  3. El sistema detecta, filtra y lee `csv/xlsx/xls/txt`.
  4. Cada base pasa por el normalizador existente y se integra al periodo activo.

## Logs disponibles
En pantalla (panel de importación) y en consola verás:
- archivo leído,
- tipo detectado y confianza,
- columnas reconocidas,
- columnas no mapeadas,
- errores de lectura,
- cobertura de cruce por archivo y global.
- resumen por prioridad (`P0/P1/P2/P3/PB`).
- resumen por canal sugerido (`Marcador/WhatsApp/SMS/Email/Blaster/Manual`).
