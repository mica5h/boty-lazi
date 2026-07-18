#!/usr/bin/env bash
#
# migrate-prod.sh — pull the live shoes.json from the Rosti server, backfill
# item groups with migrate-groups.mjs, push it back, and verify. Includes a
# rollback path that restores the exact pre-migration file.
#
# The server's data/ is excluded from `rostictl deploy`, so this is how live
# records get their `groups` field. store.js re-reads the file on every
# request, so changes take effect immediately — no restart needed.
#
# Usage:
#   ./migrate-prod.sh --host <node>.rosti.cz --port <port> [options]
#
# Modes (pick one):
#   (default)     Dry run: pull the live file and show what WOULD change. No writes.
#   --apply       Pull, back up, migrate, push, and verify.
#   --rollback    Restore the pre-migration backup (.orig) to the server.
#
# Options:
#   --host <h>        SSH host        (required; see `rostictl ssh` / Rosti dashboard)
#   --port <p>        SSH port        (required; Rosti uses a non-22 port)
#   --user <u>        SSH user        (default: app)
#   --key <path>      SSH private key (default: ~/.ssh/id_ed25519)
#   --default <list>  Groups for items with none (default: panske,boty)
#
# Get --host/--port/--user from `rostictl ssh` or the Rosti web dashboard
# (app "botylazi", id 9114 -> SSH access).
set -euo pipefail

# ---- Defaults --------------------------------------------------------------
SSH_HOST=""
SSH_PORT=""
SSH_USER="app"
KEY="$HOME/.ssh/id_ed25519"
DEFAULT_GROUPS="panske,boty"
MODE="dryrun" # dryrun | apply | rollback

REMOTE="/srv/app/data/shoes.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR="/tmp/botylazi-migrate"
WORK="$WORKDIR/shoes-prod.json"
ORIG="$WORK.orig"

# ---- Parse args ------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --host)     SSH_HOST="$2"; shift 2 ;;
    --port)     SSH_PORT="$2"; shift 2 ;;
    --user)     SSH_USER="$2"; shift 2 ;;
    --key)      KEY="$2"; shift 2 ;;
    --default)  DEFAULT_GROUPS="$2"; shift 2 ;;
    --apply)    MODE="apply"; shift ;;
    --rollback) MODE="rollback"; shift ;;
    -h|--help)  sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$SSH_HOST" ] || [ -z "$SSH_PORT" ]; then
  echo "Error: --host and --port are required. See '$0 --help'." >&2
  exit 2
fi

mkdir -p "$WORKDIR"
SSH_TARGET="$SSH_USER@$SSH_HOST"

pull() { scp -i "$KEY" -P "$SSH_PORT" "$SSH_TARGET:$REMOTE" "$1"; }
push() { scp -i "$KEY" -P "$SSH_PORT" "$1" "$SSH_TARGET:$REMOTE"; }

verify() {
  # Confirm the server now matches the file we intended to upload ($1).
  local expect="$1" got="$WORK.verify"
  pull "$got"
  if diff -q "$expect" "$got" >/dev/null; then
    echo "OK: server matches the uploaded file."
  else
    echo "MISMATCH: server differs from what was pushed:" >&2
    diff "$expect" "$got" >&2 || true
    return 1
  fi
}

# ---- Rollback --------------------------------------------------------------
if [ "$MODE" = "rollback" ]; then
  if [ ! -f "$ORIG" ]; then
    echo "Error: no pre-migration backup at $ORIG — nothing to roll back to." >&2
    echo "(It is created by a previous --apply run.)" >&2
    exit 1
  fi
  echo "Restoring pre-migration file to the server..."
  push "$ORIG"
  verify "$ORIG"
  echo "Rollback complete."
  exit 0
fi

# ---- Pull ------------------------------------------------------------------
echo "Pulling live data file from $SSH_TARGET:$REMOTE ..."
pull "$WORK"

# ---- Dry run ---------------------------------------------------------------
echo
echo "=== Migration plan (dry run) ==="
node "$SCRIPT_DIR/migrate-groups.mjs" --file "$WORK" --default "$DEFAULT_GROUPS"

if [ "$MODE" = "dryrun" ]; then
  echo
  echo "Dry run only. Re-run with --apply to write changes to production."
  exit 0
fi

# ---- Apply -----------------------------------------------------------------
# Keep an untouched copy of exactly what production had, for rollback.
cp "$WORK" "$ORIG"
echo
echo "Saved pre-migration backup: $ORIG"

echo
echo "=== Applying migration ==="
node "$SCRIPT_DIR/migrate-groups.mjs" --file "$WORK" --default "$DEFAULT_GROUPS" --apply

echo
echo "Pushing migrated file back to the server..."
push "$WORK"

# ---- Verify ----------------------------------------------------------------
echo
echo "=== Verify ==="
verify "$WORK"

node -e '
const fs = require("fs");
const items = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const bad = items.filter(s => !Array.isArray(s.groups) || s.groups.length === 0);
console.log(`items: ${items.length}, missing groups: ${bad.length}`);
bad.forEach(s => console.log("  no groups:", s.id, s.title));
process.exit(bad.length ? 1 : 0);
' "$WORK.verify"

echo
echo "Done. Reload the gallery to confirm the filter pills and card tags appear."
echo "To undo: $0 --host $SSH_HOST --port $SSH_PORT --user $SSH_USER --rollback"
