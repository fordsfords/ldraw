#/bin/bash

mv_repo() {
  F="$1"
  BASE="${F%%.*}"  # strip everything past the first dot.
  I=0
  while [ -f "prev/$BASE.tz ($I).b64" ]; do
    I=$((I + 1))
  done
  echo mv "$HOME/sford/Downloads/$F" "prev/$BASE.tz ($I).b64"
  mv "$HOME/sford/Downloads/$F" "prev/$BASE.tz ($I).b64"
}

if [ ! -d prev ]; then :
  mkdir prev
fi
# Copy regular files.
for F in *; do :
  if [ -f "$HOME/sford/Downloads/$F" ]; then :
    echo $F
    mv "$F" prev/
    mv "$HOME/sford/Downloads/$F" .
  fi
done

# Copy repo files
if [ -f "$HOME/sford/Downloads/ldraw-repo.tz.b64" ]; then :
  mv_repo "ldraw-repo.tz.b64"
fi
for REPO in $HOME/sford/Downloads/ldraw*.b64; do :
  if [ -f "$REPO" ]; then :
    F=`basename "$REPO"`
    mv_repo "$F"
  fi
done
