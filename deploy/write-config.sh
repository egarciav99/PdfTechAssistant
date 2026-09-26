#!/bin/sh
# Genera config.json a partir de variables de entorno del contenedor.
# Si no se define ninguna, se mantiene el config.json que venga en la imagen.
set -e
TARGET=/usr/share/nginx/html/config.json

if [ -z "${SUPABASE_URL}${SUPABASE_ANON_KEY}${COMPANY_NAME}${LOGO_URL}${DEFAULT_LANGUAGE}" ]; then
  exit 0
fi

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

case "${DEFAULT_LANGUAGE:-es}" in
  en) LANG_VALUE=en ;;
  *) LANG_VALUE=es ;;
esac

cat > "$TARGET" <<JSON
{
  "companyName": "$(json_escape "${COMPANY_NAME:-}")",
  "logoUrl": "$(json_escape "${LOGO_URL:-}")",
  "defaultLanguage": "${LANG_VALUE}",
  "supabase": {
    "url": "$(json_escape "${SUPABASE_URL:-}")",
    "anonKey": "$(json_escape "${SUPABASE_ANON_KEY:-}")"
  }
}
JSON
echo "PDF Technical Assistant: config.json generado"
