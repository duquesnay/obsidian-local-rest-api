#!/bin/bash
# Test vault endpoint

source .env

echo "Testing basic vault endpoint..."
curl -k -H "Authorization: Bearer $OBSIDIAN_API_KEY" https://127.0.0.1:27124/vault/ --max-time 5 2>/dev/null