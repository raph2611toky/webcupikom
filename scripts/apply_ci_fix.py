#!/usr/bin/env python3
from pathlib import Path
import re
import shutil
import sys

root = Path.cwd()
jenkins = root / "Jenkinsfile"
requirements = root / "backend" / "requirements.txt"

if not jenkins.exists():
    sys.exit("ERREUR: lance ce script depuis la racine du dépôt (Jenkinsfile introuvable).")
if not requirements.exists():
    sys.exit("ERREUR: backend/requirements.txt est absent. Extrais d'abord tout le correctif à la racine du dépôt.")

text = jenkins.read_text(encoding="utf-8")
start_re = re.compile(r"(?m)^(?P<indent>[ \t]*)stage\s*\(\s*['\"]Test Backend['\"]\s*\)\s*\{")
next_re = re.compile(r"(?m)^[ \t]*stage\s*\(\s*['\"]Prepare Backend['\"]\s*\)\s*\{")

m = start_re.search(text)
if not m:
    sys.exit("ERREUR: stage 'Test Backend' introuvable dans Jenkinsfile.")
n = next_re.search(text, m.end())
if not n:
    sys.exit("ERREUR: stage 'Prepare Backend' introuvable après 'Test Backend'.")

indent = m.group("indent")
i1 = indent
i2 = indent + "    "
i3 = indent + "        "
i4 = indent + "            "

replacement = f"""{i1}stage('Test Backend') {{
{i2}when {{
{i3}branch 'backend'
{i2}}}
{i2}steps {{
{i3}sh '''
{i4}set -eu

{i4}# CI uniquement : aucune connexion à la base MySQL/MariaDB finale du cPanel.
{i4}# Sans DB_NAME, Django utilise SQLite pour `check`; pendant `test`,
{i4}# settings.py bascule déjà explicitement sur SQLite en mémoire.
{i4}run_django() {{
{i4}    docker run --rm \\
{i4}      -e SECRET_KEY=jenkins-ci-secret \\
{i4}      -e MODE_DEV=False \\
{i4}      -e DEBUG=False \\
{i4}      -e CORS_ALLOW_ALL_ORIGINS=False \\
{i4}      -e TEST_USE_SQLITE=True \\
{i4}      -e REALTIME_ENABLED=False \\
{i4}      webcup-backend:latest "$@"
{i4}}}

{i4}run_django python manage.py check
{i4}run_django python manage.py makemigrations --check --dry-run
{i4}run_django python manage.py test --noinput
{i3}'''
{i2}}}
{i1}}}

"""

# Remove accidental leading '+' markers if this source was edited as a diff-like block.
replacement = "\n".join(line[1:] if line.startswith("+") else line for line in replacement.splitlines()) + "\n"

backup = root / "Jenkinsfile.before_backend_ci_fix"
if not backup.exists():
    shutil.copy2(jenkins, backup)

new_text = text[:m.start()] + replacement + text[n.start():]
jenkins.write_text(new_text, encoding="utf-8")

print("OK: Jenkinsfile corrigé.")
print("OK: backend/requirements.txt est présent.")
print("Sauvegarde: Jenkinsfile.before_backend_ci_fix")
print("Vérifie maintenant: git diff -- Jenkinsfile backend/requirements.txt")
