#!/bin/bash
# Simple rename test

source .env

echo "Testing rename endpoint..."
echo "Using API key: ${OBSIDIAN_API_KEY:0:20}..."

curl -k -X POST \
    -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
    -H "Content-Type: text/plain" \
    -d 'test_rename_target.md' \
    https://127.0.0.1:27124/vault/simple-test.md/rename \
    --max-time 10 \
    --connect-timeout 5 \
    -v 2>&1