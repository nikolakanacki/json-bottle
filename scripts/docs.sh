#!/bin/bash

rm -rf ./docs;
jsdoc \
  -c ./conf.docs.json \
  -t ./node_modules/ink-docstrap/template \
  -d ./docs \
  -r ./README.md ./index.js ./src
