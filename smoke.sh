#!/usr/bin/env bash
# Step 6: register a user, submit a feature request, confirm both survive a
# restart. The one runnable check for the whole backend.
set -euo pipefail

API=${API:-http://localhost:8000}
USER=smoke-$RANDOM
PASS=smoke-password

req() { curl -fsS -H 'Content-Type: application/json' "$@"; }

echo "waiting for $API/health"
for _ in $(seq 30); do
  curl -fsS "$API/health" >/dev/null 2>&1 && break || sleep 2
done
req "$API/health" | grep -q '"ok"'

echo "register $USER"
TOKEN=$(req -X POST "$API/api/auth/register" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/')
[ -n "$TOKEN" ]

echo "login as $USER"
req -X POST "$API/api/auth/login" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" | grep -q token

echo "honeypot is rejected"
curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\",\"website\":\"http://spam\"}" \
  | grep -q 400

echo "submit a feature request"
ID=$(req -X POST "$API/api/features" -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Smoke test request","body":"Written by smoke.sh"}' \
  | sed -E 's/.*"id":([0-9]+).*/\1/')

echo "vote on it"
req -X POST "$API/api/features/$ID/vote" -H "Authorization: Bearer $TOKEN" | grep -q '"votes":1'

echo "restarting backend and postgres"
docker compose restart backend postgres >/dev/null
for _ in $(seq 30); do
  curl -fsS "$API/health" >/dev/null 2>&1 && break || sleep 2
done

echo "data survived the restart"
req "$API/api/features" | grep -q "Smoke test request"
req -X POST "$API/api/auth/login" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" | grep -q token

echo "PASS"
