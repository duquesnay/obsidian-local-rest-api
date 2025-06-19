#!/bin/bash
# Test rename using PATCH endpoint with correct headers

source .env

echo "Testing rename via PATCH endpoint..."
echo "Using API key: ${OBSIDIAN_API_KEY:0:20}..."
echo ""

echo "1. Renaming simple-test.md to test_rename_target.md"
curl -k -X PATCH \
    -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
    -H "Content-Type: text/plain" \
    -H "Operation: replace" \
    -H "Target-Type: file" \
    -H "Target: name" \
    -d 'test_rename_target.md' \
    https://127.0.0.1:27124/vault/simple-test.md \
    2>/dev/null

echo ""
echo ""
echo "2. Checking if file was renamed - listing vault files with 'test_rename'"
curl -k -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
    https://127.0.0.1:27124/vault/ 2>/dev/null | grep -o '"[^"]*test_rename[^"]*"' | head -5