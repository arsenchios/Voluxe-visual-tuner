#!/bin/zsh
# Double-click this file, choose a folder with index.html, and tune it locally.
set -e
SCRIPT_DIR="${0:A:h}"

if [[ -n "$1" ]]; then
  TARGET_DIR="$1"
else
  TARGET_DIR="$(osascript -e 'POSIX path of (choose folder with prompt "Choose the folder that contains index.html")')"
fi

python3 "$SCRIPT_DIR/visual_tuner.py" --dir "$TARGET_DIR"
