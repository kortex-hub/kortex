#!/usr/bin/env bash
# Redact secrets from collected CI logs before artifact upload.
# Builds dynamic sed patterns from secrets.txt key names (if available)
# plus static patterns for known API key prefixes as defense-in-depth.
set -euo pipefail

SECRETS_FILE="${SECRETS_FILE:-secrets.txt}"

escape_sed() {
  printf '%s' "$1" | sed 's/[&/\]/\\&/g'
}

build_sed_script() {
  if [ -f "$SECRETS_FILE" ]; then
    while IFS='=' read -r key value; do
      [ -z "$key" ] && continue
      # Key-name patterns: KEY=value and "KEY":"value"
      echo "s/\"${key}\":\"[^\"]*\"/\"${key}\":\"***REDACTED***\"/g"
      echo "s/${key}=[^[:space:]\"&;,]+/${key}=***REDACTED***/g"
      # Value-based: redact the raw secret anywhere it appears
      if [ -n "$value" ]; then
        escaped=$(escape_sed "$value")
        echo "s/${escaped}/***REDACTED***/g"
      fi
    done < "$SECRETS_FILE"
  fi

  # Static: known API key prefixes (defense-in-depth)
  echo 's/sk-ant-api[0-9A-Za-z_-]+/***REDACTED***/g'
  echo 's/sk-proj-[0-9A-Za-z_-]+/***REDACTED***/g'
  echo 's/ghp_[0-9A-Za-z]+/***REDACTED***/g'
  echo 's/github_pat_[0-9A-Za-z_]+/***REDACTED***/g'
  echo 's/AIzaSy[0-9A-Za-z_-]+/***REDACTED***/g'
  echo 's/Authorization:[[:space:]]*Bearer[[:space:]]+[^[:space:]"]+/Authorization: Bearer ***REDACTED***/g'
}

sanitize_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  sed -E -f "$SED_SCRIPT" "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
}

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <file-or-directory>..."
  echo "Set SECRETS_FILE env var to point to the secrets file (default: secrets.txt)"
  exit 1
fi

SED_SCRIPT=$(mktemp)
trap 'rm -f "$SED_SCRIPT"' EXIT
build_sed_script > "$SED_SCRIPT"

if [ ! -s "$SED_SCRIPT" ]; then
  echo "WARNING: No sanitization patterns generated"
  exit 0
fi

for target in "$@"; do
  if [ -d "$target" ]; then
    while IFS= read -r -d '' file; do
      sanitize_file "$file"
    done < <(find "$target" -type f \( -name '*.log' -o -name '*.json' -o -name '*.xml' -o -name '*.txt' \) -print0)
  else
    sanitize_file "$target"
  fi
done

echo "Sanitized secrets in collected logs"
