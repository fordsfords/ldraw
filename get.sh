#/bin/bash

if [ ! -f ~/sford/Downloads/ldraw-repo.tz.b64 ]; then :
  echo "Not found: ~/sford/Downloads/ldraw-repo.tz.b64"
  exit 1
fi

echo "Getting Claude's changes into branch 'claude-main'"
mv ~/sford/Downloads/ldraw-repo.tz.b64 /tmp
rm -rf /tmp/ldraw-temp
mkdir /tmp/ldraw-temp

base64 -d /tmp/ldraw-repo.tz.b64 | ( cd /tmp/ldraw-temp; tar xzf - )
( cd /tmp/ldraw-temp; git checkout . )

git fetch /tmp/ldraw-temp main:claude-main
cat <<__EOF__

When ready, do: git merge claude-main
Then can do: git branch -d claude-main
__EOF__
