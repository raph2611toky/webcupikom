#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
GUARD="$ROOT/backend/scripts/precommit_guard.py"
HOOK="$ROOT/.git/hooks/pre-commit"
[ -f "$GUARD" ] || { echo "Guard introuvable: $GUARD" >&2; exit 1; }
cat > "$HOOK" <<EOF
#!/usr/bin/env bash
set -e
python3 "$GUARD"
EOF
chmod +x "$HOOK"
echo "Hook pre-commit installé: $HOOK"
