# Development Scripts

This directory contains various scripts used during development of the Obsidian Local REST API plugin.

## Directory Structure

### `/dev`
Development and launch scripts:
- `obsidian-launcher.sh` - Launch Obsidian with logging
- `obsidian-launcher-verbose.sh` - Launch with verbose logging
- `dev-watch.sh` - Watch files and auto-rebuild during development

### `/test`
Test scripts for API endpoints:
- `test-api.sh` - General purpose test script
- `test-rename-*.sh` - Scripts for testing the rename endpoint
- `test-vault.sh` - Test vault operations
- `cleanup-test-files.sh` - Clean up test files

### `/debug`
Debug and diagnostic scripts:
- `reload-plugin.js` - Manual plugin reload script
- `force-reload.js` - Force reload plugin from correct directory
- `aggressive-reload.js` - Aggressive reload with cache clearing
- `test-hot-reload.js` - Test hot reload functionality

## Usage

Most shell scripts can be run directly:
```bash
./scripts/dev/obsidian-launcher.sh start
./scripts/test/test-api.sh status
```

Debug scripts should be run in Obsidian's Developer Console (Cmd+Option+I).