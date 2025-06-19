#!/bin/bash
# Test rename error cases

source .env

echo "Testing rename error cases..."
echo ""

echo "1. Try to rename non-existent file"
curl -k -X PATCH \
    -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
    -H "Content-Type: text/plain" \
    -H "Operation: replace" \
    -H "Target-Type: file" \
    -H "Target: name" \
    -d 'should_fail.md' \
    https://127.0.0.1:27124/vault/nonexistent.md \
    2>/dev/null

echo ""
echo ""
echo "2. Try to rename to existing filename"
curl -k -X PATCH \
    -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
    -H "Content-Type: text/plain" \
    -H "Operation: replace" \
    -H "Target-Type: file" \
    -H "Target: name" \
    -d 'test_rename_20250617_160735.md' \
    https://127.0.0.1:27124/vault/test_rename_target.md \
    2>/dev/null

echo ""