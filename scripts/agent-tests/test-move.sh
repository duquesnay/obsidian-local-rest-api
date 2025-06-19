#!/bin/bash
# Test script for Agent 2: Testing move functionality

echo "=== Testing Move Endpoint Functionality ==="
echo "Agent 2: Testing move endpoint enhancements"
echo

# Set up test variables
API_KEY="${OBSIDIAN_API_KEY:-test-key}"
BASE_URL="https://127.0.0.1:27124"
TEST_FILE="agent2-test-move.md"
TEST_DIR="agent2-test-dir"

echo "Testing PATCH /vault/{filepath} with Target-Type: file..."

# Test 1: Create test file
echo "Test 1: Creating test file..."
curl -k -X PUT "$BASE_URL/vault/$TEST_FILE" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: text/markdown" \
  -d "# Test File for Agent 2

This file will be moved to test the move endpoint." \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo

# Test 2: Test rename operation
echo "Test 2: Testing rename (Target: name)..."
curl -k -X PATCH "$BASE_URL/vault/$TEST_FILE" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: text/plain" \
  -H "Operation: replace" \
  -H "Target-Type: file" \
  -H "Target: name" \
  -d "agent2-renamed.md" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo

# Test 3: Test move operation
echo "Test 3: Testing move (Target: path)..."
curl -k -X PATCH "$BASE_URL/vault/agent2-renamed.md" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: text/plain" \
  -H "Operation: replace" \
  -H "Target-Type: file" \
  -H "Target: path" \
  -d "$TEST_DIR/agent2-moved.md" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo

# Test 4: Verify moved file exists
echo "Test 4: Verifying moved file..."
curl -k -X GET "$BASE_URL/vault/$TEST_DIR/agent2-moved.md" \
  -H "Authorization: Bearer $API_KEY" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo

# Test 5: Test error cases
echo "Test 5: Testing error case - invalid Target..."
curl -k -X PATCH "$BASE_URL/vault/$TEST_DIR/agent2-moved.md" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: text/plain" \
  -H "Operation: replace" \
  -H "Target-Type: file" \
  -H "Target: invalid" \
  -d "newname.md" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo

# Test 6: Clean up
echo "Test 6: Cleaning up test files..."
curl -k -X DELETE "$BASE_URL/vault/$TEST_DIR/agent2-moved.md" \
  -H "Authorization: Bearer $API_KEY" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo
echo "=== Move Endpoint Tests Complete ==="