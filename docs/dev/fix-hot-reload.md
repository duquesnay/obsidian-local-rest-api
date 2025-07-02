# Quick Fix for Hot Reload with Symlinks

## The Issue
The Hot Reload plugin on macOS may not properly detect file changes in symlinked directories due to how FSEvents handles symlinks.

## Quick Solution

1. **Open Obsidian Developer Console** (Cmd+Option+I)

2. **Run this code to patch the hot reload behavior**:

```javascript
// Patch hot reload to force watching symlinked directories
const hotReloadPlugin = app.plugins.plugins['hot-reload'];
if (hotReloadPlugin) {
    const pluginId = 'obsidian-local-rest-api';
    const manifest = app.plugins.manifests[pluginId];
    
    if (manifest) {
        // Force start watching the directory
        app.vault.adapter.startWatchPath(manifest.dir, false);
        console.log(`Force watching: ${manifest.dir}`);
        
        // Add to enabled plugins
        hotReloadPlugin.enabledPlugins.add(pluginId);
        
        // Trigger initial scan
        hotReloadPlugin.checkVersion(pluginId);
        
        console.log("Hot reload patched for", pluginId);
    }
}
```

3. **Alternative: Use the Command Palette**
   - Press `Cmd+P`
   - Type "Hot Reload: Check plugins for changes"
   - Press Enter

## Permanent Solutions

### Option 1: Use the dev-watch.sh script
```bash
cd /Users/guillaume/Dev/tools/mcp-obsidian/obsidian-local-rest-api
./dev-watch.sh
```

### Option 2: Install fswatch and use automatic copying
```bash
brew install fswatch
# Then use the dev-watch.sh script which will use fswatch
```

### Option 3: Configure your build to output directly to Obsidian
In your `esbuild.config.mjs`, change the output to:
```javascript
outfile: `${process.env.HOME}/ObsidianNotes/.obsidian/plugins/obsidian-local-rest-api/main.js`
```

## Testing Hot Reload

1. Make a small change to a source file
2. Save the file
3. If using dev-watch.sh, it will automatically build and copy
4. You should see a notification: "Plugin 'obsidian-local-rest-api' has been reloaded"

## If Hot Reload Still Doesn't Work

Run this in the Developer Console to manually reload:
```javascript
(async () => {
    const id = 'obsidian-local-rest-api';
    await app.plugins.disablePlugin(id);
    await app.plugins.enablePlugin(id);
    new Notice(`Plugin "${id}" reloaded`);
})();
```