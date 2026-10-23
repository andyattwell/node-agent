## Ejecutor de pruebas E2E

Ejecute pruebas end-to-end (E2E) con automatización de navegador utilizando Playwright (servidor MCP). Si se produce algún error y las aserciones fallan, marque la prueba como fallida y explique exactamente qué falló.

## Instrucciones

- Leer el `e2e_test_file`
- Analizar la `User Story` para comprender primero qué estamos validando
- IMPORTANTE: Ejecutar los `Test Steps` detallados en el `e2e_test_file` usando Playwright para automatización de navegador
- Revisar los `Criterios de éxito` y, si alguno falla, marcar la prueba como fallida y explicar exactamente qué falló
- Revisar los pasos que indican `**Verificar**...` y, si fallan, marcar la prueba como fallida y explicar exactamente qué falló
- Realizar capturas de pantalla según lo especificado
- IMPORTANTE: Devolver los resultados en el formato solicitado por el `Formato de salida`
- Inicializar el navegador Playwright en Modo headed para visibilidad
- Usar `application_url`
- Dejar tiempo para operaciones asíncronas y visibilidad de elementos
- IMPORTANTE: Después de tomar cada captura de pantalla, dardarla en el `Directorio de Capturas de Pantalla` con nombres descriptivos. Use rutas absolutas para mover los archivos al `Directorio de Capturas de Pantalla` con el nombre correcto.
- Capturar e informar cualquier error encontrado
- Considerar los `Pasos de la Prueba` y ejecutarlos en orden.
- Si encuentra un error, marcar la prueba como fallida inmediatamente y explicar exactamente qué falló y en qué paso ocurrió. Por ejemplo: '(Paso 1 ❌) No se pudo encontrar el elemento con el selector "query-input" en la página "http://localhost:5173"'
- Use `pwd` o equivalente para obtener la ruta absoluta al código base para escribir y mostrar las rutas correctas a las capturas de pantalla.

## Configuración

- IMPORTANTE: Restablezca la base de datos ejecutando `scripts/reset_db.sh`.
- IMPORTANTE: Asegúrese de que el servidor y el cliente se estén ejecutando en segundo plano antes de ejecutar los pasos de prueba. Consulte `scripts/` y `README.md` para obtener más información sobre cómo iniciar, detener y restablecer el servidor y el cliente.

## Directorio de capturas de pantalla

<project_root>/trees/<id_adw>/tests/img/{nombre del directorio basado en el nombre del archivo de prueba}/\*.png

Cada captura de pantalla debe guardarse con un nombre descriptivo que refleje lo que se está capturando. La estructura del directorio garantiza que:

- Las capturas de pantalla se organizan por ID de ADW (ejecución del flujo de trabajo).
- Se almacenan bajo el nombre del agente especificado (p. ej., e2e_test_runner_0, e2e_test_resolver_iter1_0).
- Cada prueba tiene su propio subdirectorio según el nombre del archivo de prueba (p. ej., test_basic_query → basic_query/).

## Salida

**OBLIGATORIO**: Devolver json con resultados. Nada más, sin comillas ni saltos de línea.

- **Correcto**: {
  "test_name": "Test Name Here",
  "status": "passed",
  "screenshots": [],
  "error": null
  }
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
