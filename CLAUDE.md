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

## Feature Backlog

### Directory Operations (In Progress)
- [x] Move Directory - COMPLETED
  - PATCH `/vault/{path}` with `Operation: move`, `Target-Type: directory`, `Target: path`
  - File-by-file approach preserves links, handles nested structures
  - Atomic operations with rollback capability
- [x] Create Directory - COMPLETED
  - POST `/vault/{path}` with `Target-Type: directory`
  - Support nested directory creation, conflict detection
  - Validates paths and handles edge cases gracefully
- [x] Delete Directory - COMPLETED
  - DELETE `/vault/{path}` with `Target-Type: directory`
  - Two modes: trash (default) vs permanent deletion (`Permanent: true`)
  - Recursive deletion with safety checks and proper cleanup
- [x] Copy Directory - COMPLETED
  - POST `/vault/{destination}` with `Operation: copy`, `Target-Type: directory`  
  - Source path provided in request body
  - Preserves source directory, creates full duplicate
  - File-by-file copy maintains content integrity
- [ ] Directory Metadata - LOW PRIORITY
  - GET `/vault/{path}` with enhanced directory information
  - File counts, size totals, modification dates
  - Directory tree structure info

### Future Enhancements
- [ ] Bulk file operations across multiple directories
- [ ] Directory watching/change events via WebSocket
- [ ] Advanced filtering and search within directories
- [ ] Directory templates and scaffolding
- [ ] Import/export directory structures

## Project Learnings

### 2025-01-02 - File Operations Security Implementation
**Methodological:**
- Security-first development pattern: Starting with working implementation then systematically adding security layers proved highly effective. Rather than trying to build everything perfectly from the start, we: (1) Got core functionality working, (2) Identified security gaps through code review, (3) Systematically addressed each vulnerability, (4) Added comprehensive tests for each security measure. This approach prevented security from becoming an afterthought while keeping development momentum.

**Technical:**  
- Validation layering strategy for file operations: Discovered the importance of validation at multiple levels - input validation (filename format, characters), path validation (traversal protection, absolute paths), file system validation (conflicts, permissions), and cross-platform validation (reserved names, length limits). Each layer catches different attack vectors, creating defense in depth that's more robust than any single validation approach.

**Methodological:**
- Test-driven security validation: Writing security tests first (17 new tests covering attack scenarios) was crucial for confidence. Testing malicious inputs like `../malicious.md`, reserved names like `CON.md`, and edge cases provided concrete validation that security measures actually work, not just theoretical protection.

### 2025-01-02 - Directory Move Operation Implementation
**Methodological:**
- Research-driven implementation validation: When the user questioned "isn't there some obsidian api operation capable of doing it?", conducting web research to understand how Obsidian actually handles folder moves internally proved crucial. This research revealed that native `FileManager.renameFile()` with `TFolder` only moves the folder container, not contents, validating our file-by-file approach as the correct solution that mirrors Obsidian's own internal behavior.

**Technical:**
- File-by-file approach for directory operations: Discovered that robust directory moves in Obsidian require individual `FileManager.renameFile()` calls for each contained file rather than folder-level operations. This ensures proper link preservation throughout the vault, as each file's move operation updates all references to that specific file. Native folder operations (`adapter.rename()`, `FileManager.renameFile()` with `TFolder`) only move containers without handling contents or links.

**Methodological:**
- Iterative cleanup and testing workflow: The progression from working implementation → research validation → systematic cleanup → comprehensive testing proved highly effective. Rather than trying to optimize prematurely, we: (1) Got functionality working, (2) Validated the approach through research, (3) Systematically removed experimental code, (4) Ensured all tests pass. This kept working code as the foundation while improving quality incrementally.