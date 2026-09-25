#!/usr/bin/env bash
# Builds Hunt and registers it as a desktop app (launcher + icon) for the
# current user. Re-run after pulling changes to rebuild. Remove with:
#   npm run desktop:uninstall
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICONS="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$APPS/hunt.desktop" "$ICONS/512x512/apps/hunt.png" "$ICONS/192x192/apps/hunt.png"
  update-desktop-database "$APPS" 2>/dev/null || true
  gtk-update-icon-cache -q "$ICONS" 2>/dev/null || true
  echo "Hunt launcher removed. Your data in $ROOT/data is untouched."
  exit 0
fi

echo "Building Hunt…"
(cd "$ROOT" && npm run build)

# npm can skip Electron's postinstall download; fetch the binary if missing.
[[ -f "$ROOT/node_modules/electron/path.txt" ]] || "$NODE" "$ROOT/node_modules/electron/install.js"

install -Dm644 "$ROOT/public/icon-512.png" "$ICONS/512x512/apps/hunt.png"
install -Dm644 "$ROOT/public/icon-192.png" "$ICONS/192x192/apps/hunt.png"

mkdir -p "$APPS"
cat > "$APPS/hunt.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Hunt
GenericName=Job Search CRM
Comment=A personal CRM for the internship and job search
Exec=env HUNT_NODE="$NODE" "$ROOT/node_modules/.bin/electron" "$ROOT"
Path=$ROOT
Icon=hunt
Terminal=false
Categories=Office;
StartupWMClass=Hunt
StartupNotify=true
EOF

update-desktop-database "$APPS" 2>/dev/null || true
gtk-update-icon-cache -q "$ICONS" 2>/dev/null || true

echo "Done. Hunt is in your app launcher (search \"Hunt\"); right-click it in the dock to pin."
