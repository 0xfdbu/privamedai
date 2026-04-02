#!/bin/bash
# Deploy fresh contract and register issuer

set -e

export SYNC_CACHE=.
export WALLET_SEED="jewel fluid image merge dice edit oblige cloud fragile travel canal annual decide album steak stand physical venture earn divide eye announce prison regular"

# Issuer to register (user's Lace wallet)
ISSUER_PUBKEY="${1:-525c7a9abecae88ed7bd2d8198762e9852670ab134df08a07ddf1a5c3f759362}"
NAME_HASH="${2:-19d4b3a150a0e5f6789012345678901234567890abcdef1234567890abcdef12}"

echo "========================================"
echo "PrivaMedAI Fresh Deployment"
echo "========================================"
echo "Admin Seed: $WALLET_SEED"
echo "Issuer PubKey: $ISSUER_PUBKEY"
echo ""

# Run the deployment and registration
cd "$(dirname "$0")"
node dist/deploy-and-register.js "$ISSUER_PUBKEY" "$NAME_HASH"
