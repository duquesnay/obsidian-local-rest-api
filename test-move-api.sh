#!/bin/bash

# Test script for the Obsidian Local REST API move and rename file functionality

# Configuration
API_KEY="${OBSIDIAN_API_KEY:-your-api-key-here}"
API_HOST="${OBSIDIAN_HOST:-127.0.0.1}"
API_PORT="${OBSIDIAN_PORT:-27124}"
BASE_URL="https://${API_HOST}:${API_PORT}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Testing Obsidian Local REST API File Operations"
echo "==============================================="
echo ""

# Test 1: Create a test file
echo "Test 1: Creating test file..."
curl -k -X PUT \
  "${BASE_URL}/vault/test-file.md" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: text/markdown" \
  -d "# Test File

This is a test file for the move and rename operations.

Created at: $(date)" \
  -s -o /dev/null -w "%{http_code}"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Test file created successfully${NC}"
else
  echo -e "${RED}✗ Failed to create test file${NC}"
  exit 1
fi

# Test 2: Move file to a new location using semantic operation
echo ""
echo "Test 2: Moving file to subfolder..."
HTTP_CODE=$(curl -k -X PATCH \
  "${BASE_URL}/vault/test-file.md" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: text/plain" \
  -H "Operation: move" \
  -H "Target-Type: file" \
  -H "Target: path" \
  -d "test-folder/moved-file.md" \
  -s -o /tmp/move-response.json -w "%{http_code}")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ File moved successfully${NC}"
  echo "Response: $(cat /tmp/move-response.json)"
else
  echo -e "${RED}✗ Failed to move file (HTTP $HTTP_CODE)${NC}"
  echo "Response: $(cat /tmp/move-response.json)"
fi

# Test 3: Verify file exists at new location
echo ""
echo "Test 3: Verifying file at new location..."
HTTP_CODE=$(curl -k -X GET \
  "${BASE_URL}/vault/test-folder/moved-file.md" \
  -H "Authorization: Bearer ${API_KEY}" \
  -s -o /tmp/file-content.txt -w "%{http_code}")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ File found at new location${NC}"
  echo "Content preview: $(head -n 3 /tmp/file-content.txt)"
else
  echo -e "${RED}✗ File not found at new location (HTTP $HTTP_CODE)${NC}"
fi

# Test 4: Verify file no longer exists at old location
echo ""
echo "Test 4: Verifying file removed from old location..."
HTTP_CODE=$(curl -k -X GET \
  "${BASE_URL}/vault/test-file.md" \
  -H "Authorization: Bearer ${API_KEY}" \
  -s -o /dev/null -w "%{http_code}")

if [ "$HTTP_CODE" = "404" ]; then
  echo -e "${GREEN}✓ File correctly removed from old location${NC}"
else
  echo -e "${RED}✗ File still exists at old location (HTTP $HTTP_CODE)${NC}"
fi

# Test 5: Test rename operation (move within same directory)
echo ""
echo "Test 5: Testing rename operation..."
HTTP_CODE=$(curl -k -X PATCH \
  "${BASE_URL}/vault/test-folder/moved-file.md" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: text/plain" \
  -H "Operation: rename" \
  -H "Target-Type: file" \
  -H "Target: name" \
  -d "renamed-file.md" \
  -s -o /tmp/rename-response.json -w "%{http_code}")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ File renamed successfully${NC}"
  echo "Response: $(cat /tmp/rename-response.json)"
else
  echo -e "${RED}✗ Failed to rename file (HTTP $HTTP_CODE)${NC}"
  echo "Response: $(cat /tmp/rename-response.json)"
fi

# Test 6: Test invalid operation combinations
echo ""
echo "Test 6: Testing invalid operation combinations..."

# Test rename with wrong target
HTTP_CODE=$(curl -k -X PATCH \
  "${BASE_URL}/vault/test-folder/renamed-file.md" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: text/plain" \
  -H "Operation: rename" \
  -H "Target-Type: file" \
  -H "Target: path" \
  -d "should-fail.md" \
  -s -o /tmp/error-response.json -w "%{http_code}")

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected rename with Target: path${NC}"
  echo "Error: $(cat /tmp/error-response.json | jq -r .message)"
else
  echo -e "${RED}✗ Should have rejected rename with Target: path${NC}"
fi

# Test move with wrong target
HTTP_CODE=$(curl -k -X PATCH \
  "${BASE_URL}/vault/test-folder/renamed-file.md" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: text/plain" \
  -H "Operation: move" \
  -H "Target-Type: file" \
  -H "Target: name" \
  -d "should-fail.md" \
  -s -o /tmp/error-response.json -w "%{http_code}")

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected move with Target: name${NC}"
  echo "Error: $(cat /tmp/error-response.json | jq -r .message)"
else
  echo -e "${RED}✗ Should have rejected move with Target: name${NC}"
fi

# Cleanup
echo ""
echo "Cleaning up test files..."
curl -k -X DELETE \
  "${BASE_URL}/vault/test-folder/renamed-file.md" \
  -H "Authorization: Bearer ${API_KEY}" \
  -s -o /dev/null

echo ""
echo "Test complete!"