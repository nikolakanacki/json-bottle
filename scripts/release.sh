#!/bin/bash

newVersion="$npm_package_version";

git add package.json;

if ! [ -z $(git ls-files -m) ]; then
  echo "=> ERROR: Tree not clean";
  exit 1;
fi;

sed -e \
  's/version\-[0-9]\.[0-9]\.[0-9]\-/version-'"$newVersion"'-/' \
  README.md > README.md.tmp && mv README.md.tmp README.md;

yarn docs;

git add .;

git commit -m "chore: version bump $newVersion";
