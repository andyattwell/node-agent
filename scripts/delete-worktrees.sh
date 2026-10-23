#!/bin/bash
# Root directory of the repository
cd development
ROOT_DIR="$(pwd)/.."
echo "Root directory: $ROOT_DIR"

# Delete all git worktrees
git -C $ROOT_DIR worktree prune

# Delete all worktrees in the trees directory
find $ROOT_DIR/trees/ -type d -name "adw-*" -exec rm -rf {} \;
