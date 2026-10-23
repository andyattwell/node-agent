#!/bin/bash

# Search for a pattern in files under a directory (under base path).
# Usage: ./search-in-files.sh <pattern> <directory> <maxResults>
# Example: ./search-in-files.sh "console.log" . 100

pattern=$1
directory=$2
maxResults=$3


if [ -z "$directory" ]; then
    directory="."
fi

if [ -z "$maxResults" ]; then
    maxResults=100
fi
echo "Directory: $directory"
echo "Max results: $maxResults"
echo "Pattern: $pattern"

# Excluded directories array
excludedDirs=("^node_modules$" ".[^.]*")
excludedDirsFlag=""

for dir in "${excludedDirs[@]}"; do
    excludedDirsFlag+="--exclude-dir=$dir "
done

cmd="grep -irnw \"$directory\" $excludedDirsFlag -e \"$pattern\" -m $maxResults | head -n $maxResults"
echo "Running command: $cmd"
result=$(eval $cmd)

# turn off echo
# set +x

# Parse results. 
# Retrieve file, line number and line content and build a JSON array. 
results=()
echo "{\"results\":["
i=0
while read -r line; do
    i=$((i+1))
    file=$(echo "$line" | cut -d: -f1)
    lineNumber=$(echo "$line" | cut -d: -f2)
    # truncate line content to 40 characters around the pattern
    lineContent=$(echo "$line" | cut -d: -f3- | sed "s/$pattern//g" | sed "s/^[[:space:]]*//;s/[[:space:]]*$//" | cut -c-40)
    res="{\"file\":\"$file\",\"lineNumber\":\"$lineNumber\",\"lineContent\":\"$lineContent\"}"
    # if it's not the last line, add a comma
    if [ $i -ne $maxResults ]; then
        res+=","
    fi
    results+=($res)
    # print the result in a new line
    echo "$res"
done < <(echo "$result")

# turn on echo
# set -x

echo "]}"