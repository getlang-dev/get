#!/bin/bash

set -e

for dir in packages/*; do
  tsc -p $dir
  sed -i.bak 's/workspace://g' "$dir/package.json"
  rm "$dir/package.json.bak" "tsconfig.json"
done

changeset publish

rm -rf dist packages/*/dist
git restore packages
