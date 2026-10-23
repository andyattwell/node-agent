#!/bin/bash

echo "🧹 Deleting worktrees..."
./scripts/delete-worktrees.sh
echo "🧹 Deleting branches..."
./scripts/delete-branches.sh
echo "🧹 Deleting state..."
./scripts/delete-state.sh
echo "✅ Done!"