#!/bin/bash

set -e

tsc -p packages

for dir in dist/*; do
  pkg=$(basename "$dir")
  mv "$dir" "packages/$pkg/dist"
  sed -i.bak 's/workspace://g' "packages/$pkg/package.json" && \
    rm "packages/$pkg/package.json.bak"
done

changeset publish

rm -rf dist packages/*/dist
git restore packages/*/package.json
