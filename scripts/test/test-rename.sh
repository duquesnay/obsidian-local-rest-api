#!/bin/bash
# Test script for rename endpoint

# Load API key from .env
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

API_URL="https://127.0.0.1:27124"

echo "=== Testing Rename Endpoint ==="
echo "API Key: ${OBSIDIAN_API_KEY:0:20}..."

# Test 1: Rename simple-test.md to test_rename_target.md
echo -e "\n1. Testing successful rename: simple-test.md -> test_rename_target.md"
RESPONSE=$(curl -k -X POST \
    -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
    -H "Content-Type: text/plain" \
    -d 'test_rename_target.md' \
    "$API_URL/vault/simple-test.md/rename" 2>/dev/null)

echo "Response: $RESPONSE"

# Test 2: Try to rename non-existent file
echo -e "\n2. Testing rename of non-existent file"
RESPONSE=$(curl -k -X POST \
    -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
    -H "Content-Type: text/plain" \
    -d 'should_fail.md' \
    "$API_URL/vault/nonexistent.md/rename" 2>/dev/null)

echo "Response: $RESPONSE"

# Test 3: Try to rename to existing file
echo -e "\n3. Testing rename to existing filename"
RESPONSE=$(curl -k -X POST \
    -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
    -H "Content-Type: text/plain" \
    -d 'test_rename_20250617_160735.md' \
    "$API_URL/vault/test_rename_target.md/rename" 2>/dev/null)

echo "Response: $RESPONSE"

echo -e "\n=== Test Complete ==="