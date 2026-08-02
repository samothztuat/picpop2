#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# picpop git-autosave — Code-Sicherung über Firestore-Briefkasten (ContextR-Mechanik)
#
# Wird per launchd alle 60 s gestartet. Ablauf:
#   1. Auto-Commit lokaler Änderungen (max. alle 30 min, KEIN Push)
#   2. „Commit von Hand"-Wunsch aus system/git abarbeiten
#   3. „Push von Hand"-Wunsch aus system/git abarbeiten (→ GitHub)
#   4. Aktuellen Stand (Commit/Push/ahead/dirty) zurück nach system/git melden
#
# Auth gegen Firestore: Web-API-Key (die Firestore-Regeln sind aktuell offen).
# Sobald die Regeln scharf sind, muss hier ein Service-Account-Token rein.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO="/Users/tomtautz/picpop"
PROJEKT="picpop-bilddatenbank"
KEY="AIzaSyBXnMXIhhaI3G3kvYfgRpceUy1k9oJ4cXs"
GIT="/usr/bin/git"
PY="/usr/bin/python3"
COMMIT_ABSTAND=1800                       # Auto-Commit höchstens alle 30 min
LASTFILE="$REPO/.git/.autosave-last"
DOK="https://firestore.googleapis.com/v1/projects/$PROJEKT/databases/(default)/documents/system/git"

cd "$REPO" 2>/dev/null || exit 0
nowISO=$(date -u +%FT%TZ)

# ── Firestore lesen ──────────────────────────────────────────────────────────
doc=$(curl -s "$DOK?key=$KEY")
getfield() {
  printf '%s' "$doc" | "$PY" -c "import sys,json
try: d=json.load(sys.stdin)
except: d={}
print(d.get('fields',{}).get('$1',{}).get('stringValue',''))" 2>/dev/null
}
commitReq=$(getfield commitRequestedAt)
pushReq=$(getfield pushRequestedAt)

# ── Firestore schreiben: fs_set feld=wert [feld=wert ...] ────────────────────
fs_set() {
  local mask="" fields="" kv k v
  for kv in "$@"; do
    k="${kv%%=*}"; v="${kv#*=}"
    mask="$mask&updateMask.fieldPaths=$k"
    v=$(printf '%s' "$v" | "$PY" -c "import sys,json;print(json.dumps(sys.stdin.read()))")
    fields="$fields\"$k\":{\"stringValue\":$v},"
  done
  fields="${fields%,}"
  curl -s -X PATCH "$DOK?key=$KEY$mask" -H "Content-Type: application/json" \
    -d "{\"fields\":{$fields}}" >/dev/null 2>&1
}
melde() { fs_set lastResult="$1" lastResultMsg="$2" lastResultAt="$(date -u +%FT%TZ)"; }

# ── 1. Auto-Commit (kein Push) ───────────────────────────────────────────────
if [ -n "$($GIT status --porcelain 2>/dev/null)" ]; then
  last=$(cat "$LASTFILE" 2>/dev/null || echo 0)
  now=$(date +%s)
  if [ $((now - last)) -ge "$COMMIT_ABSTAND" ]; then
    $GIT add -A && $GIT commit -q -m "Autosicherung $(date '+%d.%m.%Y %H:%M')" && echo "$now" > "$LASTFILE"
  fi
fi

# ── 2. Commit von Hand ───────────────────────────────────────────────────────
if [ -n "$commitReq" ]; then
  fs_set commitRequestedAt=""
  if [ -n "$($GIT status --porcelain 2>/dev/null)" ]; then
    if $GIT add -A && $GIT commit -q -m "Sicherung von Hand $(date '+%d.%m.%Y %H:%M')"; then
      melde "commit:ok" "gesichert"
    else
      melde "commit:fehler" "Commit fehlgeschlagen"
    fi
  else
    melde "commit:nichts" "nichts zu sichern"
  fi
fi

# ── 3. Push von Hand ─────────────────────────────────────────────────────────
if [ -n "$pushReq" ]; then
  fs_set pushRequestedAt=""
  # offene Änderungen vorher sichern
  if [ -n "$($GIT status --porcelain 2>/dev/null)" ]; then
    $GIT add -A && $GIT commit -q -m "Sicherung vor Push $(date '+%d.%m.%Y %H:%M')"
  fi
  errf=$(mktemp)
  if $GIT push origin HEAD >"$errf" 2>&1; then
    melde "push:ok" "gepusht"
    fs_set lastPushAt="$nowISO"
  else
    tailmsg=$(tail -n 1 "$errf" | head -c 140)
    melde "push:fehler" "${tailmsg:-Push fehlgeschlagen}"
  fi
  rm -f "$errf"
fi

# ── 4. Stand melden ──────────────────────────────────────────────────────────
branch=$($GIT rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
subj=$($GIT log -1 --pretty=%s 2>/dev/null || echo "")
lastCommit=$($GIT log -1 --pretty=%cI 2>/dev/null || echo "")
$GIT fetch -q origin "$branch" 2>/dev/null || true
ahead=$($GIT rev-list --count "origin/$branch..HEAD" 2>/dev/null || echo 0)
lastPush=$(getfield lastPushAt)
dirty=$([ -n "$($GIT status --porcelain 2>/dev/null)" ] && echo ja || echo nein)
fs_set lastCommitAt="$lastCommit" lastCommitSubject="$subj" branch="$branch" ahead="$ahead" dirty="$dirty" updatedAt="$nowISO"
