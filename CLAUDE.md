# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build Commands
- `npm run build` - Production build using esbuild with TypeScript type checking
- `npm run dev` - Development build with watch mode
- `npm run build-docs` - Generate OpenAPI documentation using jsonnet

### Testing
- `npm test` - Run Jest tests with TypeScript support and mocked Obsidian API
- Tests are configured in `jest.config.js`

### Documentation
- `npm run serve-docs` - Serve OpenAPI docs using Swagger UI in Docker

### Development Tools
- `scripts/dev/dev-watch.sh` - Auto-rebuild on file changes using fswatch (requires `brew install fswatch`)
- `scripts/dev/obsidian-launcher.sh` - Launch Obsidian with enhanced logging
  - Usage: `./obsidian-launcher.sh {start|restart|stop|logs}`
  - Logs saved to `~/Library/Logs/Obsidian/`
  - REST API runs on HTTPS port 27124
- `scripts/dev/obsidian-launcher-verbose.sh` - Maximum verbosity logging for debugging

## Architecture Overview

### Core Components

**Main Plugin (`src/main.ts`)**
- Extends Obsidian's Plugin class
- Manages dual HTTPS/HTTP servers (ports 27124/27123)
- Handles SSL certificate generation with node-forge
- Provides settings UI configuration

**Request Handler (`src/requestHandler.ts`)**
- Express.js-based server with middleware
- All REST API endpoints implementation
- Bearer token authentication (SHA-256 hashed API keys)
- CORS handling and security headers

**API Extension System (`src/api.ts`)**
- Allows other plugins to register custom endpoints
- Secure router isolation per extension
- Extension lifecycle management

**Type System (`src/types.ts`)**
- Comprehensive TypeScript interfaces
- Error code definitions and response structures
- Settings and metadata type definitions

### Key Technical Patterns

**Content Processing**
- Uses `markdown-patch` for structured content modifications
- `json-logic-js` for dynamic query processing
- Obsidian FileManager integration for proper link updating

**Security Model**
- HTTPS by default with self-signed certificates
- API key authentication with configurable requirements
- Subject Alternative Names for custom hostnames

**File Operations**
- Move/rename operations preserve internal links automatically
- PATCH operations can insert content at specific sections/headings
- Full CRUD operations on notes with metadata preservation

## Development Environment Setup

### Hot Reload Development
- Uses **Hot Reload Community Plugin** for Obsidian
- Manual reload is more reliable than automatic file watching
- Multiple reload methods:
  
**1. Command Palette** (most reliable):
- Press Cmd+P → "Hot Reload: Check plugins for changes"

**2. REST API endpoint**:
```bash
curl -k -X POST https://127.0.0.1:27124/commands/hot-reload:scan-for-changes/
```

**3. Developer Console** (Cmd+Option+I):
```javascript
(async () => {
    await app.plugins.disablePlugin('obsidian-local-rest-api');
    await app.plugins.enablePlugin('obsidian-local-rest-api');
    new Notice('Plugin reloaded!');
})();
```

### Logging Considerations
- Plugin startup logs are filtered by Obsidian
- Only runtime console.log appears in log files
- Use enhanced logging scripts for different verbosity levels

### Testing Strategy
- Unit tests with Jest and mocked Obsidian API
- Integration tests via shell scripts in `scripts/test/`
- API testing with cURL commands
- Mock implementations in `__tests__/` directory

## Special Considerations

### Complex Command Issues
- Claude Code has permission parsing issues with piped commands
- Use shell scripts in `scripts/` for complex operations
- Dedicated test scripts avoid repeated permission prompts

### Dependencies
- **node-forge** for SSL certificate management
- **Express.js** for HTTP server framework
- **mime-types** for content type detection
- **markdown-patch** for content operations

### Plugin Extension Points
- Other plugins can register API endpoints via the extension system
- Router isolation ensures security between extensions
- Extensions follow lifecycle management patterns

## Code Review Findings

### Critical Security Considerations
- **Certificate Generation**: Current implementation sets `cA: true` making certificates act as CAs. Should be restricted to server authentication only
- **Request Size Limit**: 1024MB limit is excessive for text-based API, consider reducing to 10MB
- **Path Validation**: File operations need additional validation against path traversal attacks

### Architectural Patterns to Maintain
- **RequestHandler**: Large monolithic class (1,429 lines) handles multiple responsibilities. Consider breaking into focused handlers while preserving existing API contracts
- **Error Responses**: Mix of custom responses and `returnCannedResponse`. Standardize on the canned response pattern
- **SSL/TLS Implementation**: Well-designed with proper SANs support
- **Authentication System**: Bearer token pattern is consistently applied

### Testing Approach
- Current tests focus on authentication and basic endpoints
- Integration tests needed for file operations and error scenarios
- Performance testing needed for large vault operations

### Known Performance Considerations
- Search operations use sequential `await` in loops
- Certificate regeneration happens on every settings change
- Consider implementing pagination for large vault operations

## Useful Commands Summary

```bash
# Start Obsidian with verbose logging
./scripts/dev/obsidian-launcher-verbose.sh restart

# Watch and build automatically
./scripts/dev/dev-watch.sh

# View latest REST API logs
tail -f ~/Library/Logs/Obsidian/obsidian-console-*.log | grep -E "\[REST API\]"

# Test if API is running
curl -k https://127.0.0.1:27124/

# Get list of commands
curl -k https://127.0.0.1:27124/commands/
```