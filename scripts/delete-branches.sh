#!/bin/bash

# Delete all adw branches
git branch -D $(git branch --list --no-color | grep "adw-")