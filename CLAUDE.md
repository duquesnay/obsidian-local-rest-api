# Obsidian Local REST API Plugin - Project Guide

## Project Overview
This is the Obsidian Local REST API plugin that provides a REST API interface for interacting with Obsidian vaults. The plugin is being actively developed with hot reload support for faster development cycles.

## Development Environment Setup

### Key Scripts and Tools
- **obsidian-launcher.sh**: Script to launch Obsidian with verbose logging
  - Logs are saved to `~/Library/Logs/Obsidian/`
  - REST API runs on HTTPS port 27124 (not 27123)
  - Usage: `./obsidian-launcher.sh {start|restart|stop|logs}`

- **dev-watch.sh**: Development watcher for automatic builds
  - Watches src/ directory for changes
  - Automatically rebuilds and triggers hot reload
  - Requires `fswatch` (install with `brew install fswatch`)

- **test-hot-reload.js**: Diagnostic script for testing hot reload
  - Run in Obsidian Developer Console (Cmd+Option+I)
  - Provides manual reload function: `reloadPlugin()`

### Hot Reload Configuration
- Hot Reload Community Plugin is installed
- `.hotreload` file exists in plugin directory
- No symlinks - plugin files are directly in Obsidian's plugin directory

### Known Issues & Solutions

#### Hot Reload Not Detecting Changes
The Hot Reload plugin may not automatically detect file changes. Current workarounds:

1. **Manual Reload via Command Palette**:
   - Press Cmd+P
   - Type "Hot Reload: Check plugins for changes"
   - Press Enter

2. **REST API Reload**:
   ```bash
   curl -k -X POST https://127.0.0.1:27124/commands/hot-reload:scan-for-changes/
   ```

3. **Developer Console Reload**:
   ```javascript
   (async () => {
       await app.plugins.disablePlugin('obsidian-local-rest-api');
       await app.plugins.enablePlugin('obsidian-local-rest-api');
       new Notice('Plugin reloaded!');
   })();
   ```

### Logging Configuration

#### Current Issues with Logging
- The default `obsidian-launcher.sh` uses minimal verbosity (`--v=1`)
- Plugin startup console logs are NOT captured in standard logs
- Only runtime logs (like HTTP requests) appear in logs
- Console messages during `onload()` are filtered out

#### Enhanced Logging Script
Use `obsidian-launcher-verbose.sh` for maximum verbosity:
```bash
./obsidian-launcher-verbose.sh restart
```

This creates multiple log files:
- `obsidian-console-*.log` - Contains runtime console messages
- `obsidian-stdout-verbose.log` - Stdout/stderr output
- `obsidian-filtered-*.log` - Real-time filtered REST API messages

#### What Gets Logged
- ✅ REST API HTTP requests/responses
- ✅ Runtime console.log/error after plugin is loaded  
- ❌ Plugin constructor calls
- ❌ Plugin onload() console messages
- ❌ Hot reload file watcher events

#### Viewing Logs
```bash
# Runtime REST API logs
grep -E "\[REST API\]" ~/Library/Logs/Obsidian/obsidian-console-*.log

# All REST API related messages
grep -i "rest.api\|plugin.*loaded\|hot.*reload" ~/Library/Logs/Obsidian/*.log
```

### Build Commands
- `npm run build` - Build the plugin
- `npm test` - Run tests
- `npm run dev` - Build in watch mode

### Testing the API
```bash
# Check if API is running
curl -k https://127.0.0.1:27124/

# Get list of commands
curl -k https://127.0.0.1:27124/commands/

# Trigger hot reload
curl -k -X POST https://127.0.0.1:27124/commands/hot-reload:scan-for-changes/
```

## Current Development Tasks

### Rename Endpoint Implementation

#### API Contract
The rename endpoint must support the following contract:

**Endpoint**: `PATCH /vault/{filepath}`

**Headers**:
- `Authorization: Bearer {api_key}`
- `Content-Type: text/plain`
- `Operation: replace`
- `Target-Type: file`
- `Target: name`

**Body**: New filename only (not full path)
- Example: To rename `folder/old-file.md` to `folder/new-file.md`, send body: `new-file.md`

**Responses**:
- `200 OK` - Success with JSON: `{"message": "File successfully renamed", "oldPath": "...", "newPath": "..."}`
- `404 Not Found` - Source file doesn't exist
- `409 Conflict` - Destination file already exists

#### Implementation Requirements
1. **Intercept BEFORE validation**: The request must be handled before the standard PATCH validation that only accepts heading/block/frontmatter as Target-Type
2. **Use FileManager API**: Call `app.fileManager.renameFile()` for proper Obsidian integration
3. **Preserve links**: The FileManager API automatically updates all internal links
4. **Handle paths correctly**: Extract directory from old path, combine with new filename from body

#### Current Issue
The validation rejects `Target-Type: file` as invalid. The fix requires either:
- Adding 'file' to the valid Target-Type enum in the OpenAPI schema
- OR intercepting the request before validation when headers match this pattern

Reference implementation available in: `/Users/guillaume/Dev/tools/mcp-obsidian/obsidian-rest-api-contribution/`

### File Structure
- Main plugin file: `src/main.ts`
- Request handler: `src/requestHandler.ts` 
- OpenAPI docs: `docs/openapi.yaml`
- Tests: `src/requestHandler.test.ts`

## Development Workflow

1. Make changes to source files
2. Run `npm run build` or use `./dev-watch.sh` for automatic builds
3. Trigger reload using one of the methods above
4. Check logs in `~/Library/Logs/Obsidian/` if needed
5. Test changes via REST API calls

## Important Notes
- Always use HTTPS on port 27124 for API calls
- API requires authentication token (check settings)
- **Plugin startup logs are NOT captured** - only runtime logs appear
- When debugging, use Obsidian Developer Console (Cmd+Option+I)
- Manual reload methods work better than automatic hot reload

## Debugging Tools Created

### reload-plugin.js
Script for manual plugin reload in Developer Console:
```javascript
// Copy contents of reload-plugin.js and run in console
```

### test-hot-reload.js  
Diagnostic script to check hot reload status

### obsidian-launcher-verbose.sh
Enhanced launcher with maximum logging verbosity

## Useful Commands Summary
```bash
# Start Obsidian with VERBOSE logging
./obsidian-launcher-verbose.sh restart

# Watch and build automatically
./dev-watch.sh

# View latest logs (runtime only)
tail -f ~/Library/Logs/Obsidian/obsidian-console-*.log | grep -E "\[REST API\]"

# Manual hot reload via API (requires auth token)
curl -k -X POST https://127.0.0.1:27124/commands/hot-reload:scan-for-changes/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check all log files for REST API
./obsidian-launcher-verbose.sh logs
```

## Memories
- use a scratchpad and a todolist 
- anytime you need my intervention for testing, research and find a way to do it automatically instead. document your findings and go back to the problem you were solving
- ALWAYS use a todolist, and a scratchpad

## Claude Code Permission Workarounds

### Pipe Commands Issue
Claude Code's permission system doesn't handle piped commands well. Commands with `|`, `&&`, or `||` operators often fail to be recognized as already permitted, causing repeated permission prompts.

### Solution: Use Shell Scripts
1. **Create reusable shell scripts** for complex commands
2. **For one-time tasks**, reuse a general-purpose script (like `test-api.sh`) with different arguments
3. **For recurring tasks**, create dedicated scripts

Example:
```bash
# Instead of: curl -k ... | jq '.commands[]'
# Create a script that saves to temp file:
curl -k ... > /tmp/result.json
jq '.commands[]' /tmp/result.json
```

This avoids permission prompts and makes commands more maintainable.
- for one time tasks, simply reuse the same shell script so permissions don't have to be asked again. Only recurrent tasks go to their own shell script