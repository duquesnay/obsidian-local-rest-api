// Force reload script - Run this in Obsidian Developer Console
// This mimics what Hot Reload does internally

(async () => {
    const pluginId = 'obsidian-local-rest-api';
    const plugins = app.plugins;
    
    console.log('Current plugin manifest:', plugins.manifests[pluginId]);
    
    // Check if plugin is enabled
    if (!plugins.enabledPlugins.has(pluginId)) {
        console.log('Plugin is not enabled');
        return;
    }
    
    // Disable the plugin (this unloads it from memory)
    console.log('Disabling plugin...');
    await plugins.disablePlugin(pluginId);
    
    // Force Obsidian to re-scan plugin directories
    // This should pick up the main directory instead of backup
    console.log('Re-enabling plugin...');
    await plugins.enablePlugin(pluginId);
    
    console.log('Plugin reloaded!');
    console.log('New manifest:', plugins.manifests[pluginId]);
    
    // Test the debug endpoint
    setTimeout(async () => {
        try {
            const response = await fetch('https://127.0.0.1:27124/debug/info', {
                headers: {
                    'Authorization': 'Bearer fc4004ca87c1a594af0f8484f1c68d17c95af77c30b9a4c40ebe2dc6d58dae14'
                }
            });
            const data = await response.json();
            console.log('Debug endpoint response:', data);
            new Notice(`Debug endpoint: ${data.testValue || 'NOT FOUND'}`);
        } catch (e) {
            console.error('Failed to test debug endpoint:', e);
        }
    }, 1000);
})();