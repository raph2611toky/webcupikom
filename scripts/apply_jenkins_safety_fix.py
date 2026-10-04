#!/usr/bin/env python3
from pathlib import Path
import re
import shutil
import sys

root = Path.cwd()
jenkins = root / "Jenkinsfile"
if not jenkins.exists():
    sys.exit("ERREUR: lance ce script depuis la racine du dépôt (Jenkinsfile introuvable).")
if not (root / "backend" / "manage.py").exists():
    sys.exit("ERREUR: backend/manage.py introuvable. Lance le script depuis la racine du dépôt.")

text = jenkins.read_text(encoding="utf-8")
original = text

# 1) CI JWT key long enough to avoid PyJWT InsecureKeyLengthWarning.
text = text.replace(
    "SECRET_KEY=jenkins-ci-secret",
    "SECRET_KEY=jenkins-ci-secret-key-2026-at-least-32-bytes",
)

# Helpers to locate declarative stages without assuming exact indentation.
def stage_start(source: str, name: str):
    rx = re.compile(rf"(?m)^(?P<indent>[ \t]*)stage\s*\(\s*['\"]{re.escape(name)}['\"]\s*\)\s*\{{")
    return rx.search(source)

def next_stage(source: str, pos: int):
    return re.compile(r"(?m)^[ \t]*stage\s*\(\s*['\"][^'\"]+['\"]\s*\)\s*\{").search(source, pos)

# 2) Refuse to deploy a stale backend checkout. We use origin/backend already
# fetched by Jenkins checkout, so no extra credentials/fetch are required.
if "stage('Verify Backend Revision')" not in text and 'stage("Verify Backend Revision")' not in text:
    anchor = stage_start(text, "Build Backend")
    if not anchor:
        sys.exit("ERREUR: stage 'Build Backend' introuvable; Jenkinsfile non modifié.")
    indent = anchor.group("indent")
    i2 = indent + "    "
    i3 = indent + "        "
    verify_stage = f'''{indent}stage('Verify Backend Revision') {{
{i2}when {{
{i3}branch 'backend'
{i2}}}
{i2}steps {{
{i3}sh ''' + "'''" + r'''
                set -eu
                LOCAL_SHA="$(git rev-parse HEAD)"
                REMOTE_SHA="$(git rev-parse refs/remotes/origin/backend)"
                echo "Jenkins checkout : $LOCAL_SHA"
                echo "origin/backend   : $REMOTE_SHA"
                if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
                    echo "ERREUR: Jenkins essaie de déployer un commit backend obsolète."
                    echo "Un nouveau build doit être lancé pour le HEAD actuel de origin/backend."
                    exit 42
                fi
            ''' + "'''" + f'''
{i2}}}
{indent}}}

'''
    text = text[:anchor.start()] + verify_stage + text[anchor.start():]

# 3) Harden the deployment package: don't FTP docs/tests/patch manifests/examples.
prep = stage_start(text, "Prepare Backend")
if not prep:
    sys.exit("ERREUR: stage 'Prepare Backend' introuvable; Jenkinsfile non modifié.")
prep_next = next_stage(text, prep.end())
prep_end = prep_next.start() if prep_next else len(text)
prep_block = text[prep.start():prep_end]
marker = "# PIPELINE_SAFETY_RUNTIME_ONLY"
if marker not in prep_block:
    # Inject immediately before the last shell triple-quote in this stage.
    quote_positions = [m.start() for m in re.finditer(r"'''", prep_block)]
    if len(quote_positions) < 2:
        sys.exit("ERREUR: bloc shell de 'Prepare Backend' non reconnu; Jenkinsfile non modifié.")
    insert_at_local = quote_positions[-1]
    cleanup = r'''
            # PIPELINE_SAFETY_RUNTIME_ONLY
            # Production receives runtime files only. Keep documentation and tests in Git/Jenkins.
            DEPLOY_DIR="${WORKSPACE}/deploy-backend"
            rm -rf "$DEPLOY_DIR/docs"
            find "$DEPLOY_DIR" -type f \( \
              -name 'test*.py' -o \
              -name '*_test.py' -o \
              -name 'PATCH_FILES*.txt' -o \
              -name '*.md' \
            \) -delete
            rm -f "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env.production.example"

            # Fail before FTP if the runtime package is incomplete.
            test -f "$DEPLOY_DIR/manage.py"
            test -f "$DEPLOY_DIR/requirements.txt"
            test -f "$DEPLOY_DIR/config/settings.py"
            test -f "$DEPLOY_DIR/passenger_wsgi.py"
            test -d "$DEPLOY_DIR/apps/city/migrations"
            test -d "$DEPLOY_DIR/apps/users/migrations"
'''
    absolute = prep.start() + insert_at_local
    text = text[:absolute] + cleanup + text[absolute:]

if text == original:
    print("Aucun changement nécessaire: Jenkinsfile déjà sécurisé.")
    sys.exit(0)

backup = root / "Jenkinsfile.before_pipeline_safety_fix"
if not backup.exists():
    shutil.copy2(jenkins, backup)
jenkins.write_text(text, encoding="utf-8")
print("OK: Jenkinsfile sécurisé.")
print(f"Sauvegarde: {backup.name}")
print("Vérifie avant commit: git diff -- Jenkinsfile")
