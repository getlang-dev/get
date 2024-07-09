#!/bin/bash

set -e

# changeset version

tsc -p packages

sed -i '' 's/\( from '\''\.[^'\'']*\)'\''/\1.js'\''/' dist/**/*.js

for dir in dist/*; do
  pkg=$(basename "$dir")
  mv "$dir" "packages/$pkg/dist"
  sed -i '' 's/workspace://g' "packages/$pkg/package.json"
done

changeset publish

rm -rf dist packages/*/dist
git restore packages/*/package.json

git push --follow-tags
