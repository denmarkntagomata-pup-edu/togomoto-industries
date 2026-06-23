#!/usr/bin/env bash
# macOS / Linux: run this with  bash setup.sh   (or  ./setup.sh  after chmod +x)
# It just calls the cross-platform Node setup script.
set -e
cd "$(dirname "$0")"
node scripts/setup.mjs
