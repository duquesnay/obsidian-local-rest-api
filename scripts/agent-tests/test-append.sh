#!/bin/bash
# Test script for Agent 1: Testing append_content functionality

echo "=== Testing Append Content API ==="
echo "Agent 1: Investigating append_content issue"
echo

# Set up test variables
API_KEY="${OBSIDIAN_API_KEY:-test-key}"
BASE_URL="https://127.0.0.1:27124"
TEST_FILE="agent1-test-append.md"

echo "Testing POST /vault/$TEST_FILE (append content)..."

# Test 1: Create new file with content
echo "Test 1: Creating new file..."
curl -k -X POST "$BASE_URL/vault/$TEST_FILE" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: text/markdown" \
  -d "# Test File for Agent 1

This is the initial content." \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo

# Test 2: Append to existing file
echo "Test 2: Appending to existing file..."
curl -k -X POST "$BASE_URL/vault/$TEST_FILE" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: text/markdown" \
  -d "

## Appended Section

This content was appended via POST." \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo

# Test 3: Verify content
echo "Test 3: Verifying final content..."
curl -k -X GET "$BASE_URL/vault/$TEST_FILE" \
  -H "Authorization: Bearer $API_KEY" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo

# Test 4: Clean up
echo "Test 4: Cleaning up test file..."
curl -k -X DELETE "$BASE_URL/vault/$TEST_FILE" \
  -H "Authorization: Bearer $API_KEY" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo
echo "=== Append Content Tests Complete ==="