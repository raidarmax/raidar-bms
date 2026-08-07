#!/usr/bin/env bash
set -euo pipefail

TCP_PORT="${TCP_PORT:-8443}"
API_PORT="${API_PORT:-3000}"
SELF_PID="$$"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

log() { printf '[start-tracker] %s\n' "$*"; }

kill_port() {
  local port="$1"
  local pids
  pids="$(ss -tlnpH "sport = :$port" 2>/dev/null \
    | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
  [ -z "$pids" ] && return 0
  for pid in $pids; do
    [ "$pid" = "$SELF_PID" ] && continue
    log "port $port held by pid $pid — terminating"
    kill -TERM "$pid" 2>/dev/null || true
  done
  sleep 1
  pids="$(ss -tlnpH "sport = :$port" 2>/dev/null \
    | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
  for pid in $pids; do
    [ "$pid" = "$SELF_PID" ] && continue
    log "port $port still held by pid $pid — SIGKILL"
    kill -KILL "$pid" 2>/dev/null || true
  done
}

wait_free() {
  local port="$1" tries=0
  while ss -tlnH "sport = :$port" 2>/dev/null | grep -q .; do
    tries=$((tries + 1))
    if [ "$tries" -gt 10 ]; then
      log "port $port did not free after 10s — aborting"
      exit 1
    fi
    sleep 1
  done
}

log "pre-flight: freeing ports $TCP_PORT and $API_PORT"
kill_port "$TCP_PORT"
kill_port "$API_PORT"
wait_free "$TCP_PORT"
wait_free "$API_PORT"
log "ports clear — launching server"

exec node_modules/.bin/tsx --env-file=.env server/index.ts
