#!/bin/bash

set -e

RES_DIR="$(pwd)"
SOURCE="$RES_DIR/agriconnect.png"

convert_icon() {
    SIZE="$1"
    DIR="$2"

    mkdir -p "$RES_DIR/$DIR"

    magick "$SOURCE" -resize "${SIZE}x${SIZE}" -background none -gravity center -extent "${SIZE}x${SIZE}" "$RES_DIR/$DIR/ic_launcher.webp"

    magick "$SOURCE" -resize "${SIZE}x${SIZE}" -background none -gravity center -extent "${SIZE}x${SIZE}" "$RES_DIR/$DIR/ic_launcher_round.webp"
}

convert_icon 48  "mipmap-mdpi"
convert_icon 72  "mipmap-hdpi"
convert_icon 96  "mipmap-xhdpi"
convert_icon 144 "mipmap-xxhdpi"
convert_icon 192 "mipmap-xxxhdpi"

echo "Icônes générées avec succès."
