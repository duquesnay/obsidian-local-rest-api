// Reload plugin script
// Run this in Obsidian Developer Console to reload the REST API plugin

(async () => {
    const pluginId = 'obsidian-local-rest-api';
    console.error(`[RELOAD] Starting reload of ${pluginId} at ${new Date().toISOString()}`);
    
    try {
        // Check if plugin exists
        const manifest = app.plugins.manifests[pluginId];
        if (!manifest) {
            console.error(`[RELOAD] Plugin ${pluginId} not found!`);
            return;
        }
        
        console.error(`[RELOAD] Found plugin: ${manifest.name} v${manifest.version}`);
        
        // Disable plugin
        console.error('[RELOAD] Disabling plugin...');
        await app.plugins.disablePlugin(pluginId);
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Enable plugin
        console.error('[RELOAD] Enabling plugin...');
        await app.plugins.enablePlugin(pluginId);
        
        console.error(`[RELOAD] Plugin reloaded successfully at ${new Date().toISOString()}`);
        new Notice(`Plugin "${pluginId}" has been reloaded!`);
        
        // Check if hot reload plugin exists and trigger it too
        if (app.plugins.plugins['hot-reload']) {
            console.error('[RELOAD] Triggering hot reload scan...');
            app.commands.executeCommandById('hot-reload:scan-for-changes');
        }
        
    } catch (error) {
        console.error('[RELOAD] Error reloading plugin:', error);
        new Notice(`Failed to reload plugin: ${error.message}`);
    }
})();