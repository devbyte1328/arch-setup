#!/bin/bash

# Set temp location for pacman to safely write
TMPDB=/tmp/pacstrap-easyarch-db
MNTREPO=/mnt/pacstrap-easyarch-repo

# Set final destination (relative to current dir)
FINALDB=airootfs/root/pacstrap-easyarch-db
FINALCACHE=airootfs/root/pacstrap-easyarch-repo

# Create safe temp dirs
mkdir -p $TMPDB/sync
mkdir -p $MNTREPO

echo "[*] Downloading and caching base packages using pacman..."
# Get list of all dependencies
pkgs="base linux linux-firmware bc curl"
deps=$(pacman -Sp $pkgs | grep -v "^file://" | sort -u)

# Download packages and dependencies
sudo pacman -Syyw \
  --noconfirm \
  --cachedir $MNTREPO \
  --dbpath $TMPDB \
  $pkgs $deps

# Check if pacman succeeded
if [ $? -ne 0 ]; then
  echo "Pacman failed. Aborting."
  exit 1
fi

echo "[*] Creating local repository..."
repo-add $MNTREPO/pacstrap-easyarch-repo.db.tar.gz $MNTREPO/*.tar.zst

# Create final destination dirs
mkdir -p $FINALDB
mkdir -p $FINALCACHE

# Move downloaded data back to working directory
cp -r $TMPDB/* $FINALDB/
cp -r $MNTREPO/* $FINALCACHE/

# Cleanup
echo "[*] Cleaning up temporary files..."
rm -rf $TMPDB
rm -rf $MNTREPO

echo "[✓] Packages downloaded and moved to working directory successfully."
