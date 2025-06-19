// Script to reload the plugin via REST API
// This script needs to be run in Obsidian's Developer Console

(async () => {
    // First disable the backup plugin
    await app.plugins.disablePlugin('obsidian-local-rest-api');
    
    // Enable the current plugin
    await app.plugins.enablePlugin('obsidian-local-rest-api');
    
    new Notice('Plugin reloaded from current directory!');
    
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