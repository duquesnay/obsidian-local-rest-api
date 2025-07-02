# Hot Reload Plugin Analysis

## Key Findings

### 1. How Plugin Reload is Triggered (reload() method, lines 106-128)

The actual reload process is quite simple:

```typescript
async reload(plugin: string) {
    const plugins = this.app.plugins;
    
    // 1. First disable the plugin
    await plugins.disablePlugin(plugin);
    console.debug("disabled", plugin);
    
    // 2. Set debug mode to ensure sourcemaps are loaded
    const oldDebug = localStorage.getItem("debug-plugin");
    localStorage.setItem("debug-plugin", "1");
    
    // 3. Prevent sourcemap stripping
    const uninstall = preventSourcemapStripping(this.app, plugin)
    
    try {
        // 4. Re-enable the plugin (this loads the new code)
        await plugins.enablePlugin(plugin);
    } finally {
        // 5. Restore previous debug setting
        if (oldDebug === null) 
            localStorage.removeItem("debug-plugin"); 
        else 
            localStorage.setItem("debug-plugin", oldDebug);
        uninstall?.()
    }
    
    console.debug("enabled", plugin);
    new Notice(`Plugin "${plugin}" has been reloaded`);
}
```

**Key insight**: The reload is just disable → enable. Obsidian's plugin system reloads the main.js file when enabling a plugin.

### 2. preventSourcemapStripping Function (lines 131-141)

This function uses "monkey-around" library to intercept file reads:

```typescript
function preventSourcemapStripping(app: App, pluginName: string) {
    if (requireApiVersion("1.6")) return(around(app.vault.adapter, {
        read(old) {
            return function (path: string) {
                const res = old.apply(this, arguments as any)
                // Only modify the specific plugin's main.js
                if (!path.endsWith(`/${pluginName}/main.js`)) return res
                // Add comment to prevent sourcemap stripping
                return res.then(txt => txt+'\n/* nosourcemap */')
            }
        },
    }))
}
```

**Purpose**: In Obsidian 1.6+, this patches the file reading mechanism to append `/* nosourcemap */` to the plugin's main.js file. This prevents Obsidian from stripping sourcemaps, which helps with debugging.

### 3. localStorage debug-plugin Setting

The `debug-plugin` localStorage setting tells Obsidian to load plugins in debug mode:

```typescript
// Save current debug state
const oldDebug = localStorage.getItem("debug-plugin");
// Enable debug mode for loading
localStorage.setItem("debug-plugin", "1");
// ... load plugin ...
// Restore original state
if (oldDebug === null) 
    localStorage.removeItem("debug-plugin"); 
else 
    localStorage.setItem("debug-plugin", oldDebug);
```

**Purpose**: When `debug-plugin` is set to "1", Obsidian:
- Preserves sourcemaps
- Enables more detailed error messages
- Allows better debugging experience

### 4. How New Code is Loaded

The sequence is:

1. **File watcher detects changes** → `onFileChange()` is called
2. **Check if main.js or styles.css changed** → Compare mtime in statCache
3. **Request reload with debounce** → Prevents multiple rapid reloads
4. **Disable plugin** → Unloads current code from memory
5. **Enable plugin with debug mode** → Obsidian reads main.js fresh from disk
6. **Obsidian's plugin loader**:
   - Reads the new main.js file
   - Creates new plugin instance
   - Calls plugin.onload()
   - Plugin is now running new code

## Key Implementation Details

### File Watching Strategy

1. Uses Obsidian's vault adapter file watching (`app.vault.on("raw", ...)`)
2. Additional native file watching for symlinks or non-Mac/Windows systems
3. Only watches:
   - Directories with `.hotreload` file
   - Directories with `.git` directory
   - Only main.js and styles.css trigger reloads

### Debouncing and Queueing

- File changes are debounced by 750ms to avoid rapid reloads
- Plugin discovery is debounced by 250ms
- Uses a task queue to ensure operations run sequentially

### Detection Logic

```typescript
// Only reload if:
// 1. Plugin is in enabledPlugins set (has .hotreload or .git)
// 2. Plugin is currently enabled in Obsidian
// 3. File that changed is main.js or styles.css
// 4. File modification time actually changed
```

## Implications for Our Plugin

1. **Hot reload works by disable/enable cycle** - Our plugin's onload() is called each time
2. **Debug mode is temporarily enabled** - We get better error messages during reload
3. **Sourcemaps are preserved** - Better debugging experience
4. **The process is async** - There's a delay between file change and reload

## Manual Reload Implementation

Based on this analysis, to manually reload our plugin we need:

```javascript
async function reloadPlugin(pluginId) {
    // Get plugin instance
    const plugins = app.plugins;
    
    // Check if enabled
    if (!plugins.enabledPlugins.has(pluginId)) return;
    
    // Disable plugin
    await plugins.disablePlugin(pluginId);
    
    // Enable with debug mode
    const oldDebug = localStorage.getItem("debug-plugin");
    localStorage.setItem("debug-plugin", "1");
    
    try {
        await plugins.enablePlugin(pluginId);
    } finally {
        if (oldDebug === null) 
            localStorage.removeItem("debug-plugin");
        else 
            localStorage.setItem("debug-plugin", oldDebug);
    }
    
    new Notice(`Plugin "${pluginId}" reloaded`);
}
```