# Hot Reload Fix for Obsidian Plugin Development

## Problem Analysis

The Hot Reload plugin is not detecting changes to your symlinked plugin directory. This is likely due to:

1. **File watching limitations with symlinks on macOS**: FSEvents (macOS file watching system) may not properly follow symlinks in all cases
2. **Timing issues**: The plugin might need to be manually triggered after Obsidian fully loads

## Solutions

### Solution 1: Manual Trigger (Immediate Fix)

1. Open Obsidian Command Palette (Cmd+P)
2. Run: "Hot Reload: Check plugins for changes and reload them"
3. This should detect and reload your plugin

### Solution 2: Reverse Symlink Approach (Recommended)

Instead of symlinking from Obsidian to your dev directory, symlink from your build output to Obsidian:

```bash
# Remove the current symlink
rm ~/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api

# Copy the actual plugin directory to Obsidian
cp -r /Users/guillaume/Dev/tools/mcp-obsidian/obsidian-local-rest-api ~/ObsidianNotes/.obsidian/plugins/

# Now symlink your build output to overwrite files in the plugin directory
cd /Users/guillaume/Dev/tools/mcp-obsidian/obsidian-local-rest-api
ln -sf $(pwd)/main.js ~/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api/main.js
ln -sf $(pwd)/styles.css ~/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api/styles.css
ln -sf $(pwd)/manifest.json ~/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api/manifest.json
```

### Solution 3: Build Script with Copy (Alternative)

Create a build script that copies files instead of relying on symlinks:

```bash
#!/bin/bash
# build-and-reload.sh

# Build your plugin
npm run build

# Copy to Obsidian
cp main.js ~/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api/
cp styles.css ~/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api/
cp manifest.json ~/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api/

# Touch the main.js to ensure timestamp changes
touch ~/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api/main.js
```

### Solution 4: Use File Watcher with Manual Reload

Create a development watcher that triggers the hot reload command:

```bash
# Install fswatch if not already installed
brew install fswatch

# Create watcher script
fswatch -o src/*.ts | xargs -n1 -I{} sh -c 'npm run build && osascript -e "tell application \"Obsidian\" to activate" && sleep 0.5 && osascript -e "tell application \"System Events\" to keystroke \"p\" using command down" && sleep 0.5 && osascript -e "tell application \"System Events\" to keystroke \"hot reload\"" && sleep 0.5 && osascript -e "tell application \"System Events\" to key code 36"'
```

### Solution 5: Debug File Watching

To debug if file watching is working:

1. Open Obsidian Developer Console (Cmd+Option+I)
2. Run this to check if your plugin is being watched:

```javascript
// Check if hot reload detected your plugin
app.plugins.manifests['obsidian-local-rest-api']

// Check file watchers
app.vault.adapter.watchers
```

## Verification Steps

1. Make a change to your source code
2. Run your build process
3. Either:
   - Wait ~1 second for automatic reload
   - Run "Hot Reload: Check plugins for changes" command
   - Check for the notification "Plugin 'obsidian-local-rest-api' has been reloaded"

## Additional Tips

1. **Ensure .hotreload file exists**: You already have this ✓
2. **Check console logs**: Look for "disabled obsidian-local-rest-api" and "enabled obsidian-local-rest-api" messages
3. **Disable/Enable manually**: If hot reload fails, manually disable and re-enable the plugin in settings
4. **Use debug mode**: Set `localStorage.setItem('debug-plugin', '1')` in console for better error messages

## Current Status

Your setup appears correct:
- ✓ .hotreload file exists
- ✓ .git directory exists
- ✓ Symlink is properly created
- ✓ manifest.json has correct plugin ID

The issue is likely the macOS FSEvents not properly detecting changes through the symlink. Use one of the solutions above to work around this limitation.