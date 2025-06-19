#!/bin/bash

# Development watcher for Obsidian plugin with hot reload
# This script watches for changes and triggers hot reload

PLUGIN_DIR="/Users/guillaume/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api"
BUILD_DEBOUNCE=false

echo "Starting development watcher..."
echo "Watching for changes in src/ directory"
echo "Hot reload will trigger automatically"

# Function to build and copy
build_and_copy() {
    if [ "$BUILD_DEBOUNCE" = true ]; then
        return
    fi
    
    BUILD_DEBOUNCE=true
    
    echo -e "\n[$(date '+%H:%M:%S')] Changes detected, building..."
    
    # Run build
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "[$(date '+%H:%M:%S')] Build successful, triggering hot reload..."
        
        # Touch the main.js to ensure hot reload detects the change
        touch "$PLUGIN_DIR/main.js"
        
        # If styles.css exists, touch it too
        if [ -f "$PLUGIN_DIR/styles.css" ]; then
            touch "$PLUGIN_DIR/styles.css"
        fi
        
        echo "[$(date '+%H:%M:%S')] Hot reload triggered!"
    else
        echo "[$(date '+%H:%M:%S')] Build failed!"
    fi
    
    # Reset debounce after 1 second
    sleep 1
    BUILD_DEBOUNCE=false
}

# Check if fswatch is installed
if command -v fswatch &> /dev/null; then
    echo "Using fswatch for file watching"
    fswatch -o src/ | while read f; do build_and_copy; done
else
    echo "fswatch not found. Install it with: brew install fswatch"
    echo "Falling back to basic watch loop..."
    
    # Fallback to basic watch
    while true; do
        # Get current modification times
        CURRENT_HASH=$(find src/ -name "*.ts" -o -name "*.js" | xargs ls -l | md5)
        
        if [ "$LAST_HASH" != "$CURRENT_HASH" ]; then
            LAST_HASH=$CURRENT_HASH
            build_and_copy
        fi
        
        sleep 2
    done
fi