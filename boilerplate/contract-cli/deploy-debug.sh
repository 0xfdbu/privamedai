#!/bin/bash
# Debug deployment script for PrivaMedAI

set -e

export SYNC_CACHE=.
export WALLET_SEED="jewel fluid image merge dice edit oblige cloud fragile travel canal annual decide album steak stand physical venture earn divide eye announce prison regular"

# Issuer to register (user's Lace wallet)
ISSUER_PUBKEY="${1:-525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362}"
NAME_HASH="${2:-19d4b3a150a0e5f6789012345678901234567890abcdef1234567890abcdef12}"

echo "========================================"
echo "PrivaMedAI Debug Deployment"
echo "========================================"
echo ""
echo "Configuration:"
echo "  Network: preprod"
echo "  Issuer: $ISSUER_PUBKEY"
echo "  Name Hash: $NAME_HASH"
echo ""

cd "$(dirname "$0")"

echo "Building..."
npm run build 2>&1 | tail -5

echo ""
echo "Fixing imports..."
cd dist
for f in *.js; do
  sed -i 's/from "\.\/\([^."]*\)"/from "\.\/\1.js"/g' "$f" 2>/dev/null || true
  sed -i "s/from '\.\/\([^.']*\)'/from '\.\/\1.js'/g" "$f" 2>/dev/null || true
done
cd ..

echo ""
echo "Running deployment..."
echo "========================================"
node dist/deploy-and-register.js "$ISSUER_PUBKEY" "$NAME_HASH" 2>&1
