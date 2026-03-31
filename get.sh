#/bin/bash

if [ ! -d prev ]; then :
  mkdir prev
fi
for F in *; do :
  if [ -f "$HOME/sford/Downloads/$F" ]; then :
    echo $F
    mv "$F" prev/
    mv "$HOME/sford/Downloads/$F" .
  fi
done
