#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "backend" ]; then
  echo "ERREUR: branche courante '$BRANCH', attendu 'backend'." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERREUR: le working tree n'est pas propre." >&2
  git status --short
  exit 1
fi

# Refresh remote state if credentials are already configured. If fetch fails,
# stop instead of guessing what will be pushed.
git fetch --no-tags origin backend
REMOTE="$(git rev-parse origin/backend)"
HEAD="$(git rev-parse HEAD)"

if ! git merge-base --is-ancestor "$REMOTE" "$HEAD"; then
  echo "ERREUR: HEAD n'est pas descendant de origin/backend. Rebase/merge requis." >&2
  exit 1
fi

DELETIONS="$(git diff --diff-filter=D --name-only "$REMOTE..$HEAD" | wc -l | tr -d ' ')"
if [ "$DELETIONS" -ge 10 ] && [ "${ALLOW_MASS_DELETE:-0}" != "1" ]; then
  echo "ERREUR: $DELETIONS suppressions depuis origin/backend. Vérification manuelle requise." >&2
  git diff --name-status "$REMOTE..$HEAD"
  exit 1
fi

for p in backend/manage.py backend/requirements.txt backend/config/settings.py backend/passenger_wsgi.py; do
  [ -f "$p" ] || { echo "ERREUR: fichier critique absent: $p" >&2; exit 1; }
done

echo "=== Changements qui seront poussés ==="
git diff --stat "$REMOTE..$HEAD"
git diff --name-status "$REMOTE..$HEAD"

echo "=== Compilation Python ==="
python -m compileall -q backend

echo "=== Django checks (SQLite CI) ==="
cd backend
export SECRET_KEY="pre-push-local-secret-key-at-least-32-bytes"
export TEST_USE_SQLITE=True
export REALTIME_ENABLED=False
python manage.py check
python manage.py makemigrations --check --dry-run

if [ "${QUICK:-0}" = "1" ]; then
  echo "QUICK=1: tests complets ignorés."
else
  python manage.py test --noinput
fi

echo "=== PRE-PUSH OK ==="
echo "HEAD: $HEAD"
echo "origin/backend avant push: $REMOTE"
