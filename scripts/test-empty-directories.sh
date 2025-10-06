#!/bin/bash

# Integration test for empty directory listing
# This tests the REAL API, not mocks

set -e

VAULT_ROOT="${HOME}/ObsidianNotes"
API_BASE="https://127.0.0.1:27124"
API_KEY=$(grep apiKey "${VAULT_ROOT}/.obsidian/plugins/obsidian-local-rest-api/data.json" | cut -d'"' -f4)

echo "🧪 Integration Test: Empty Directory Listing"
echo "=============================================="

# Create test directories
TEST_DIR="${VAULT_ROOT}/test-empty-dirs-$$"
EMPTY_DIR1="${TEST_DIR}/empty-folder-1"
EMPTY_DIR2="${TEST_DIR}/empty-folder-2"
NON_EMPTY_DIR="${TEST_DIR}/with-file"

echo ""
echo "📁 Setup: Creating test directories..."
mkdir -p "${EMPTY_DIR1}"
mkdir -p "${EMPTY_DIR2}"
mkdir -p "${NON_EMPTY_DIR}"
echo "Test file" > "${NON_EMPTY_DIR}/test.md"

# Give Obsidian time to detect the changes
sleep 2

echo ""
echo "🔍 Test 1: List root should include empty directories"
RESPONSE=$(curl -k -s -H "Authorization: Bearer ${API_KEY}" "${API_BASE}/vault/" | jq -r '.files[]' | grep "test-empty-dirs-" || true)

if [ -z "$RESPONSE" ]; then
    echo "❌ FAIL: Test directory not found in listing"
    rm -rf "${TEST_DIR}"
    exit 1
else
    echo "✅ PASS: Test directory found in listing"
fi

echo ""
echo "🔍 Test 2: List test directory should show all subdirectories"
LISTING=$(curl -k -s -H "Authorization: Bearer ${API_KEY}" "${API_BASE}/vault/test-empty-dirs-$$/")

echo "API Response:"
echo "$LISTING" | jq '.'

# Check if empty directories are listed
EMPTY1_FOUND=$(echo "$LISTING" | jq -r '.files[]' | grep "empty-folder-1/" || echo "")
EMPTY2_FOUND=$(echo "$LISTING" | jq -r '.files[]' | grep "empty-folder-2/" || echo "")
NON_EMPTY_FOUND=$(echo "$LISTING" | jq -r '.files[]' | grep "with-file/" || echo "")

echo ""
if [ -n "$EMPTY1_FOUND" ]; then
    echo "✅ PASS: empty-folder-1/ found"
else
    echo "❌ FAIL: empty-folder-1/ NOT found"
fi

if [ -n "$EMPTY2_FOUND" ]; then
    echo "✅ PASS: empty-folder-2/ found"
else
    echo "❌ FAIL: empty-folder-2/ NOT found"
fi

if [ -n "$NON_EMPTY_FOUND" ]; then
    echo "✅ PASS: with-file/ found"
else
    echo "❌ FAIL: with-file/ NOT found"
fi

echo ""
echo "🧹 Cleanup: Removing test directories..."
rm -rf "${TEST_DIR}"

if [ -n "$EMPTY1_FOUND" ] && [ -n "$EMPTY2_FOUND" ] && [ -n "$NON_EMPTY_FOUND" ]; then
    echo ""
    echo "🎉 All integration tests PASSED!"
    exit 0
else
    echo ""
    echo "💥 Some integration tests FAILED!"
    exit 1
fi
