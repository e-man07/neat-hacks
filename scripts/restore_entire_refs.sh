#!/usr/bin/env bash
# One-time: move Entire checkpoints from temporary `_entire/*` branches to `refs/entire/*`,
# where Entire and entire.io read them. (The build sandbox could only push branches.)
# Run from a clone of the repo with normal GitHub push access.
set -euo pipefail
git fetch origin '+refs/heads/_entire/*:refs/entire/*'
git push origin 'refs/entire/*:refs/entire/*'
for b in $(git ls-remote --heads origin '_entire/*' | awk '{print $2}'); do
  git push origin --delete "${b#refs/heads/}"
done
echo "Entire checkpoints restored to refs/entire/*"
