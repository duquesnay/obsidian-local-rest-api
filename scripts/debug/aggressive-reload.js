// Aggressive reload script - Run in Obsidian Developer Console
// This attempts to clear any cached plugin paths

(async () => {
    const pluginId = 'obsidian-local-rest-api';
    const plugins = app.plugins;
    
    console.log('=== Aggressive Plugin Reload ===');
    console.log('Current manifest:', plugins.manifests[pluginId]);
    
    // Step 1: Disable the plugin
    if (plugins.enabledPlugins.has(pluginId)) {
        console.log('Disabling plugin...');
        await plugins.disablePlugin(pluginId);
    }
    
    // Step 2: Try to clear the manifest cache
    // This is undocumented but might help
    if (plugins.manifests[pluginId]) {
        console.log('Clearing manifest cache...');
        delete plugins.manifests[pluginId];
    }
    
    // Step 3: Force a re-scan by toggling safe mode
    // This is a hack but might force Obsidian to re-scan plugins
    console.log('Forcing plugin re-scan...');
    const originalSafeMode = app.vault.getConfig('safeMode');
    await app.vault.setConfig('safeMode', true);
    await new Promise(resolve => setTimeout(resolve, 100));
    await app.vault.setConfig('safeMode', originalSafeMode);
    
    // Step 4: Re-enable the plugin
    console.log('Re-enabling plugin...');
    try {
        await plugins.enablePlugin(pluginId);
        console.log('Plugin re-enabled successfully!');
    } catch (e) {
        console.error('Failed to re-enable:', e);
        // Try to load it manually
        console.log('Attempting manual load...');
        await plugins.loadPlugin(pluginId);
    }
    
    console.log('New manifest:', plugins.manifests[pluginId]);
    
    // Test the result
    setTimeout(async () => {
        try {
            const response = await fetch('https://127.0.0.1:27124/');
            const data = await response.json();
            console.log('API Status:', data);
            new Notice(`Plugin loaded from: ${data.manifest?.dir || 'UNKNOWN'}`);
            
            // Try debug endpoint
            const debugResponse = await fetch('https://127.0.0.1:27124/debug/info', {
                headers: { 'Authorization': 'Bearer fc4004ca87c1a594af0f8484f1c68d17c95af77c30b9a4c40ebe2dc6d58dae14' }
            });
            if (debugResponse.ok) {
                const debugData = await debugResponse.json();
                console.log('Debug endpoint:', debugData);
                new Notice(`Debug endpoint working! Test value: ${debugData.testValue}`);
            } else {
                console.log('Debug endpoint not found (404)');
            }
        } catch (e) {
            console.error('API test failed:', e);
        }
    }, 1000);
})();