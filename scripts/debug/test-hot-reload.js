// Test script to run in Obsidian Developer Console
// This will help diagnose hot reload issues

console.log("=== Hot Reload Diagnostic ===");

// Check if plugin is loaded
const pluginId = 'obsidian-local-rest-api';
const manifest = app.plugins.manifests[pluginId];
console.log("Plugin manifest:", manifest);

// Check if hot reload plugin is active
const hotReloadPlugin = app.plugins.plugins['hot-reload'];
if (hotReloadPlugin) {
    console.log("Hot Reload plugin is active");
    
    // Check if our plugin is in the enabled list
    console.log("Enabled for hot reload:", hotReloadPlugin.enabledPlugins.has(pluginId));
    
    // Check plugin names mapping
    console.log("Plugin names:", hotReloadPlugin.pluginNames);
    
    // Check stat cache
    const mainJsPath = `${manifest.dir}/main.js`;
    console.log("Stat cache for main.js:", hotReloadPlugin.statCache.get(mainJsPath));
} else {
    console.log("Hot Reload plugin not found!");
}

// Check file watchers
console.log("\n=== File Watchers ===");
console.log("Watchers:", Object.keys(app.vault.adapter.watchers || {}));

// Check if the plugin directory is being watched
const pluginDir = app.plugins.manifests[pluginId]?.dir;
if (pluginDir) {
    console.log("Plugin directory:", pluginDir);
    console.log("Is watched:", app.vault.adapter.watchers?.hasOwnProperty(pluginDir));
}

// Function to manually trigger reload
window.reloadPlugin = async function() {
    console.log("Manually reloading plugin...");
    const plugins = app.plugins;
    await plugins.disablePlugin(pluginId);
    await plugins.enablePlugin(pluginId);
    console.log("Plugin reloaded!");
    new Notice(`Plugin "${pluginId}" has been reloaded`);
};

console.log("\n=== Instructions ===");
console.log("1. Run this script in Obsidian Developer Console (Cmd+Option+I)");
console.log("2. To manually reload the plugin, run: reloadPlugin()");
console.log("3. To trigger hot reload scan, use Cmd+P -> 'Hot Reload: Check plugins for changes'");