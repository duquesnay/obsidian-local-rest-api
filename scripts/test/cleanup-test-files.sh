#!/bin/bash
# Clean up test files via REST API

source .env

echo "Cleaning up test files via REST API..."

# Array of test files to delete
test_files=(
    "test_rename_20250617_160735.md"
    "test_rename_20250617_160800.md"
    "test_rename_20250617_161318.md"
    "test_rename_20250617_164955.md"
    "test_rename_20250617_170237.md"
    "test_rename_20250617_170933.md"
    "test_rename_20250617_171018.md"
    "test_rename_20250617_171657.md"
    "test_rename_20250617_171729.md"
    "test_rename_20250617_173011.md"
    "test_rename_20250617_173112.md"
    "test_rename_20250617_173226.md"
    "test_rename_20250617_173424.md"
    "test_rename_20250617_173446.md"
    "test_rename_20250617_173529.md"
    "test_rename_20250617_173626.md"
    "test_rename_20250617_173824.md"
    "test_rename_20250617_173942.md"
    "test_rename_20250617_180820.md"
    "test_rename_20250617_180939.md"
    "test_rename_20250617_181057.md"
    "test_rename_20250617_181214.md"
    "test_rename_20250617_181522.md"
    "test_rename_20250617_181839.md"
    "test_rename_20250618_110504.md"
    "test_rename_20250618_110725.md"
    "test_rename_20250618_111832.md"
    "test_rename_20250618_111902.md"
    "test_rename_20250618_151524.md"
    "test_rename_20250618_152030.md"
    "test_rename_20250618_152150.md"
    "test_rename_20250618_194801.md"
    "test_rename_20250618_194836.md"
    "test_rename_20250618_195253.md"
    "test_rename_20250618_195424.md"
    "test_rename_20250618_195559.md"
    "test_rename_20250618_195931.md"
    "test_rename_20250618_200505.md"
    "test_rename_20250618_200648.md"
    "test_rename_20250618_202350.md"
    "test_rename_20250618_202458.md"
    "test_rename_20250618_205043.md"
    "test_rename_target.md"
    "test-original.md"
    "test-spike.md"
)

deleted_count=0
failed_count=0

for file in "${test_files[@]}"; do
    echo -n "Deleting $file... "
    response=$(curl -k -X DELETE \
        -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
        "https://127.0.0.1:27124/vault/$file" \
        -s -w "\n%{http_code}" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "204" ]; then
        echo "✓ Deleted"
        ((deleted_count++))
    elif [ "$http_code" = "404" ]; then
        echo "- Already gone"
    else
        echo "✗ Failed (HTTP $http_code)"
        ((failed_count++))
    fi
done

echo ""
echo "Summary: Deleted $deleted_count files, $failed_count failures"