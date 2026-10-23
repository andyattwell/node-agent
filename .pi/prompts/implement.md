# Implementa el siguiente plan

Sigue las instrucciones para implementar el plan definidas en el archivo `plan_path` y luego informa el trabajo completado.
IMPORTANTE: Asegura que el archivo `plan_path` exista.
IMPORTANTE: Todo el trabajo se debe realizar en $WORKING_DIRECTORY.

## Instrucciones

- Lee el plan, reflexiona sobre él e impleméntalo.
- Sigue las reglas definidas en el archivo `.cursorrules`.
- Después de cada paso de las tareas realizar un commit de los cambios con un mensaje corto (Conventional Commits).

## Variables

plan_path: $PLAN_PATH
plan: $PLAN

## Informe

**OBLIGATORIO**: Guardar el resumen en state/$ADW_ID/implement/summary.md.

- Resume el trabajo realizado en una lista concisa.
- Indica la **rama** y la **ruta del worktree** donde se implementó.
- Informa los archivos y el total de líneas modificadas con `git diff --stat origin/main` (ejecutado desde el worktree).

## Salida

**OBLIGATORIO**: Despues de crear y guardar el resumen en la ruta especificada, la respuesta debe ser exactamente una línea con la ruta del archivo creado. Nada más, sin comillas ni saltos de línea.

- **Correcto**: `$STATE_DIR/implement/summary.md`
- **Incorrecto**: Incluir frases como "El plan está creado", "Ruta absoluta del archivo:", ni formato markdown (negrita, backticks). No añadir texto antes ni después del path.

## Formato de salida

$STATE_DIR/implement/summary.md
