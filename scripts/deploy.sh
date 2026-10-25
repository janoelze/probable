#!/bin/sh
# Builds the docs site (plus the library under lib/) and uploads it as static
# files over SSH/rsync. Target comes from the environment or a git-ignored
# .env.deploy next to package.json:
#
#   DEPLOY_HOST=user@example.com
#   DEPLOY_DOCROOT=/var/www/example.com
#   DEPLOY_PATH=probable            # served at https://$DEPLOY_DOMAIN/$DEPLOY_PATH/
#   DEPLOY_DOMAIN=example.com
set -eu

cd "$(dirname "$0")/.."
[ -f .env.deploy ] && . ./.env.deploy

HOST="${DEPLOY_HOST:?set DEPLOY_HOST (see scripts/deploy.sh)}"
DOCROOT="${DEPLOY_DOCROOT:?set DEPLOY_DOCROOT}"
APP_PATH="${DEPLOY_PATH:-probable}"
DOMAIN="${DEPLOY_DOMAIN:?set DEPLOY_DOMAIN}"

echo "› tests"
npx vitest run --reporter=dot

echo "› build (base /$APP_PATH/)"
BASE="/$APP_PATH/" npm run --silent site:build
npm run --silent build
# Ship the library next to the docs so it can be imported from a <script type="module">.
mkdir -p dist-site/lib && cp dist/*.js dist-site/lib/

# Refuse to publish a broken build.
test -f dist-site/index.html || { echo "dist-site/index.html missing"; exit 1; }
grep -q "/$APP_PATH/assets/" dist-site/index.html || { echo "asset paths do not use base /$APP_PATH/"; exit 1; }

echo "› upload to $HOST:$DOCROOT/$APP_PATH/"
ssh "$HOST" "mkdir -p '$DOCROOT/$APP_PATH'"
rsync -az --delete --exclude '.DS_Store' dist-site/ "$HOST:$DOCROOT/$APP_PATH/"

URL="https://$DOMAIN/$APP_PATH/"
code=$(curl -s -o /dev/null -w '%{http_code}' "$URL")
echo "› $URL → HTTP $code"
test "$code" = "200"
