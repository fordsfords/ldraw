#!/bin/sh
# Reassemble ldraw.html from ldraw-app.html + symbols.js
cd "$(dirname "$0")"
sed '/@INCLUDE symbols.js/{ r symbols.js
d }' ldraw-app.html > ldraw.html
echo "Built ldraw.html ($(wc -l < ldraw.html) lines)"
