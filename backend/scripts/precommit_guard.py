#!/usr/bin/env python3
import os
import subprocess
import sys
from pathlib import Path


def run(*args):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout

try:
    root = Path(run("git", "rev-parse", "--show-toplevel").strip())
except Exception:
    sys.exit("ERREUR: dépôt Git introuvable.")

raw = subprocess.run(
    ["git", "diff", "--cached", "--name-status", "-z", "--diff-filter=ACDMRTUXB"],
    cwd=root, check=True, stdout=subprocess.PIPE
).stdout.decode("utf-8", errors="replace").split("\0")

entries = []
i = 0
while i < len(raw) and raw[i]:
    status = raw[i]
    code = status[0]
    if code in {"R", "C"}:
        if i + 2 >= len(raw):
            break
        entries.append((code, raw[i+1], raw[i+2]))
        i += 3
    else:
        if i + 1 >= len(raw):
            break
        entries.append((code, raw[i+1], None))
        i += 2

deleted = [a for code, a, b in entries if code == "D"]
critical_exact = {
    "Jenkinsfile",
    "backend/manage.py",
    "backend/requirements.txt",
    "backend/config/settings.py",
    "backend/passenger_wsgi.py",
}
critical_deleted = [p for p in deleted if p in critical_exact or "/migrations/" in p]

bad_secret = []
for code, a, b in entries:
    p = b if code in {"R", "C"} and b else a
    low = p.lower()
    if low == "backend/.env" or low.endswith(".sqlite3") or "__pycache__" in low or low.endswith((".pyc", ".pyo")):
        bad_secret.append(p)

allow_mass = os.getenv("ALLOW_MASS_DELETE") == "1"
allow_critical = os.getenv("ALLOW_CRITICAL_DELETE") == "1"
errors = []
if len(deleted) >= 10 and not allow_mass:
    errors.append(f"{len(deleted)} suppressions sont indexées. ALLOW_MASS_DELETE=1 requis si c'est volontaire.")
if critical_deleted and not allow_critical:
    errors.append("Suppression de fichiers critiques/migrations: " + ", ".join(critical_deleted))
if bad_secret:
    errors.append("Fichiers locaux/secrets interdits dans Git: " + ", ".join(bad_secret))

if errors:
    print("\nBLOCAGE DE SÉCURITÉ GIT")
    for e in errors:
        print(" -", e)
    print("\nÉtat indexé:")
    subprocess.run(["git", "diff", "--cached", "--stat"], cwd=root)
    print("\nPour annuler l'indexation: git restore --staged <fichier>")
    sys.exit(1)

print(f"Git guard OK: {len(entries)} changement(s), {len(deleted)} suppression(s).")
