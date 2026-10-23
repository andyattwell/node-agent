---
description: Generate an implementation plan
---

## Variables

prompt: $1
WORKING_DIRECTORY: $2

Lee el prompt del usuario.
Genera un plan de implementación en el formato indicado.
IMPORTANTE: Todo el trabajo se debe realizar en `WORKING_DIRECTORY` si fue provisto.

## Objetivo

**OBLIGATORIO**: Guardar el plan en el directorio `docs` con el nombre `IMPLEMENTATION_PLAN.md` (o `IMPLEMENTATION_PLAN_{task-name}.md` si ya existe uno). `{descriptive-name}` = nombre corto (ej: `add-agent-logging`, `fix-login-issue`, `removed-unused-deps`). `{task-name}` = más específico si hay varios planes en la misma feature.

## Reglas

- **Investigación**: Empezar por `README.md`; explorar patrones en `development/`, `apps/`,`docs/`. Busca y lee losa archivos relevantes.
- **Clasificacion**: Clasifica el issue con el comando `/classify`. Ese es el issue type.
- **Idioma**: Plan en español; nombres de código (variables, tablas, columnas, archivos) en inglés.
- **Código en el plan**: Solo fragmentos mínimos que ilustren estilo y patrones; en cambios a código existente, solo las líneas a modificar.
- **Dependencias**: Si hace falta nueva librería, indicar `npm install ...` en la sección **Notas** del plan.
- **UI/E2E**: Si la feature tiene UI o interacción de usuario:
  - Incluir tarea para crear `docs/e2e/test_<nombre_descriptivo>.md` (basado en ejemplos en `docs/e2e/`).
  - En "Archivos relevantes" añadir: leer `commands/test.md` y `docs/e2e/test_basic_query.md`.
  - Incluir validación E2E en **Comandos de validación** (leer y ejecutar el nuevo test E2E).
- Después de crear el plan, genera un commit guardando el plan y prompt inicial.

## Formato del plan

```md
# <issue_type>: <nombre>

## Metadatos

prompt: `{prompt}`

## Descripción

<propósito y valor para usuarios>

## Historia de usuario

Como <usuario> quiero <acción> para que <beneficio>

## Problema y solución

- **Problema:** <qué aborda>
- **Solución:** <enfoque propuesto>

## Archivos relevantes

- <ruta>: <por qué>. (Incluir nuevos en "Nuevos archivos" si aplica.)

## Plan de implementación

### Fase 1: Cimentación

<trabajo previo necesario>
### Fase 2: Implementación principal
<trabajo central>
### Fase 3: Integración
<cómo se integra con lo existente>

## Tareas paso a paso

Ejecutar en orden. Último paso: ejecutar **Comandos de validación**.

### 1. <Nombre tarea>

- <acción>
- <código mínimo si aplica>

### 2. ...

<repetir según necesidad. Si hay UI: incluir tarea para crear `docs/e2e/test_<nombre>.md` y validar con E2E.>

## Estrategia de pruebas

- **Unitarias:** <qué probar>
- **Frontend (Vitest):** <qué probar>
- **Casos límite:** <lista>

## Criterios de aceptación

<lista específica y medible>

## Comandos de validación

Todos deben ejecutarse sin error.

- <lista de comandos de validacion. Por ej: npm run test:ci>
- Si hay E2E: leer `commands/test.md` y ejecutar `docs/e2e/test_<nombre>.md`

## Notas

<contexto, dependencias, nuevas librerías>
```

**OBLIGATORIO**: Después de generar y guardar el plan, Asegurate que el archivo del plan generado exista en el directorio indicado. Si el archivo no existe crealo y guarda el plan.

## Informe

- Devuelve exclusivamente el path al archivo del plan.

## Salida

**OBLIGATORIO**: Despues de crear y guardar el plan en la ruta especificada, la respuesta debe ser exactamente una línea con la ruta del archivo creado. Nada más, sin comillas ni saltos de línea.

- **Correcto**: `WORKING_DIRECTORY/docs/features/nombre-feature/IMPLEMENTATION_PLAN_nombre-feature.md`
- **Incorrecto**: Incluir frases como "El plan está creado", "Ruta absoluta del archivo:", ni formato markdown (negrita, backticks). No añadir texto antes ni después del path.

## Formato de salida

$WORKING_DIRECTORY/path/to/plan/file.md
