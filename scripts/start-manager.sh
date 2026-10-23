#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$PROJECT_ROOT/app/api"
CLIENT_DIR="$PROJECT_ROOT/app/client"

resolve_api_port() {
  if [[ -n "${API_PORT:-}" ]]; then
    echo "$API_PORT"
    return
  fi
  if [[ -n "${PORT:-}" ]]; then
    echo "$PORT"
    return
  fi
  if [[ -f "$API_DIR/.env" ]]; then
    local line
    line=$(grep -E '^[[:space:]]*PORT=' "$API_DIR/.env" 2>/dev/null | tail -1 || true)
    if [[ -n "$line" ]]; then
      local val="${line#*=}"
      val="${val//$'\r'/}"
      val="${val//\"/}"
      val="${val//\'/}"
      echo "$(echo "$val" | xargs)"
      return
    fi
  fi
  echo "4000"
}

API_PORT="$(resolve_api_port)"
API_PID=""

cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

echo "Starting manager... (project: $PROJECT_ROOT)"
# "$SCRIPT_DIR/start-llama-cpp.sh" &

echo "Installing API dependencies ($API_DIR)..."
cd "$API_DIR" || exit 1
npm install

echo "Starting API (port $API_PORT)..."
npm run dev &
API_PID=$!

echo "Waiting for http://localhost:${API_PORT}/health ..."
ready=0
for _ in $(seq 1 90); do
  if curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API process exited before becoming ready."
    exit 1
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo "Timed out waiting for API to respond."
  exit 1
fi
echo "API is up."

echo "Installing client dependencies ($CLIENT_DIR)..."
cd "$CLIENT_DIR" || exit 1
npm install

echo "Starting client dev server..."
npm run dev
