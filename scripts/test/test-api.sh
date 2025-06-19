#!/bin/bash
# Script to test Obsidian REST API without pipe permission issues

# Load from .env file if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    API_KEY="$OBSIDIAN_API_KEY"
else
    API_KEY="fc4004ca87c1a594af0f8484f1c68d17c95af77c30b9a4c40ebe2dc6d58dae14"
fi
API_URL="https://127.0.0.1:27124"

case "$1" in
    "status")
        curl -k "$API_URL/" 2>/dev/null
        ;;
    "create-test")
        curl -k -X PUT \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: text/markdown" \
            -d "# Test File for Rename Testing" \
            "$API_URL/vault/test-rename-me.md" \
            2>/dev/null
        ;;
    "rename-test")
        curl -k -X PATCH \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: text/plain" \
            -H "Operation: replace" \
            -H "Target-Type: file" \
            -H "Target: name" \
            -d 'renamed-successfully.md' \
            "$API_URL/vault/test-rename-me.md" \
            2>/dev/null
        ;;
    "commands")
        curl -k -H "Authorization: Bearer $API_KEY" "$API_URL/commands/" 2>/dev/null
        ;;
    "reload")
        curl -k -X POST -H "Authorization: Bearer $API_KEY" "$API_URL/commands/app:reload/" 2>/dev/null
        ;;
    "hot-reload")
        curl -k -X POST -H "Authorization: Bearer $API_KEY" "$API_URL/commands/hot-reload:scan-for-changes/" 2>/dev/null
        ;;
    "cleanup-test")
        curl -k -X DELETE \
            -H "Authorization: Bearer $API_KEY" \
            "$API_URL/vault/renamed-successfully.md" \
            2>/dev/null
        ;;
    *)
        echo "Usage: $0 {status|create-test|rename-test|cleanup-test|commands|reload|hot-reload}"
        exit 1
        ;;
esac