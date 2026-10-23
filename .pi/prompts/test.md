# E2E Test Runner

Ejecuta test end-to-end (E2E) usando Playwright browser automation (MCP Server). Si ocurre algun error y las aserciones fallan marca el test como fallado y explica que pasó.

## Variables

id_adw: $ADW_ID
project_root: $PROJECT_ROOT
implementation_plan: $PLAN_STR
implementation_sumary: $IMPLEMENTATION_SUMMARY_STR
application_url: $appUrl if provided, otherwise use http://localhost:5173

## Instructions

- Lee el archivo `implementation_sumary`
- Analiza la "Historia de usuario" del archivo `implementation_plan` para comprender primero qué estamos validando.
- IMPORTANTE: Analizar "Comandos de validación" detallados en el archivo "implementation_sumary".
- Si hay comandos definidos para E2E seguir las siguientes instrucciones sigue las instrucciones del archivo `commands/test_e2e.md`.
- Ultra considera los "Comandos de validación" y ejecútalos en orden.
- **OBLIGATORIO**: Crea un archivo json `$STATE_DIR/test/results.json` para guardar los resultados de las pruebas.
- **OBLIGATORIO**: Por cada resultado pruebas agrega un elemento a los resultados siguiendo el formato definido en "Formato de Resumen".
- Si encuentras un error, marca la prueba como fallida inmediatamente y guardala en el json con una explicacion de qué falló y en qué paso ocurrió. Por ejemplo: "(Paso 1 ❌) No se pudo encontrar el elemento con el selector "query-input" en la página "http://localhost:5173"".

## Configuración

- IMPORTANTE: Restablece la base de datos si corresponde.
- IMPORTANTE: Asegúrate de que el servidor y el cliente se estén ejecutando en segundo plano antes de ejecutar los pasos de la prueba. Lee "scripts/" y "README.md" para obtener más información sobre cómo iniciar, detener y restablecer el servidor y el cliente.

## Salida

**OBLIGATORIO**: Despues de crear y guardar el resumen en la ruta especificada, la respuesta debe ser exactamente una línea con la ruta del archivo creado. Nada más, sin comillas ni saltos de línea.

- **Correcto**: `$STATE_DIR/test/results.json`
- **Incorrecto**: Incluir frases como "Resumen de lo hecho:", ni formato markdown (negrita, backticks). No añadir texto antes ni después del path.

### Formato de Resumen

```json
{
  "test_name": "Test Name Here",
  "status": "passed|failed",
  "screenshots": [
    "<absolute path to codebase>/state/<adw_id>/<test name>/01_<descriptive name>.png",
    "<absolute path to codebase>/state/<adw_id>img/<test name>/02_<descriptive name>.png",
    "<absolute path to codebase>/state/<adw_id>/img/<test name>/03_<descriptive name>.png"
  ],
  "error": null
}
```
