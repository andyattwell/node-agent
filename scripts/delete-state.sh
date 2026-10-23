#!/bin/bash
ROOT_DIR=$(git rev-parse --show-toplevel)

# Delete all ADW state subdirectories (state/<adw_id>/)
find $ROOT_DIR/state/ -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} \;