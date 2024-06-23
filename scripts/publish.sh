#!/bin/bash

set -e

# changeset version

tsc -p packages

for dir in dist/*; do
  pkg=$(basename "$dir")
  mv "$dir" "packages/$pkg/dist"
done

changeset publish

rm -rf dist packages/*/dist

git push --follow-tags
