# Bookmarks API - User Stories

Detailed specifications for all backlog capabilities.

---

## Investigation & Foundation

### BKM-INV1: Developer understands bookmark plugin integration risks in <30min

**Who**: Developer working on bookmark API integration
**Current State**: No access to bookmark plugin internals, unknown integration risks
**Target State**: Clear understanding of integration approach, known limitations, spike completed
**Value**: Prevents days of rework from wrong architectural approach

**Acceptance Criteria**:
- [ ] Spike document created in planning/bookmarks-spike.md
- [ ] Bookmark plugin access pattern verified (app.internalPlugins.plugins.bookmarks)
- [ ] All 8 bookmark types listed with structure examples
- [ ] Integration risks documented (plugin disabled, data structure changes, race conditions)
- [ ] Recommended testing approach defined (mock strategy)

**Implementation Notes**:
- Create throwaway test script to explore bookmark plugin API
- Test with actual Obsidian vault containing diverse bookmark types
- Document undocumented API behavior discovered
- Time-box: 30 minutes exploration, 15 minutes documentation

---

### BKM-TECH1: Developer accesses bookmark data without plugin crashes

**Who**: Developer implementing bookmark endpoints
**Current State**: Direct plugin access may fail unpredictably
**Target State**: Robust helper methods with error handling
**Value**: Prevents production errors from plugin state issues

**Acceptance Criteria**:
- [ ] Helper method `getBookmarksPlugin()` returns plugin instance or throws clear error
- [ ] Helper method `isBookmarksEnabled()` checks plugin state safely
- [ ] Error code 40501 ("Bookmarks plugin not enabled") defined
- [ ] All bookmark endpoint methods use helpers consistently
- [ ] Tests verify behavior when plugin is disabled/missing

**Measurement**: Zero plugin-related crashes in development testing

---

## Core Read Capabilities

### BKM-R1: API consumer retrieves bookmark list with hierarchy intact

**Who**: External API consumer (MCP server, automation script, third-party integration)
**Current State**: No programmatic access to bookmark data
**Target State**: GET /bookmarks/ returns complete bookmark tree with nested groups
**Value**: Enables bookmark-aware integrations and automation

**Acceptance Criteria**:
- [ ] GET /bookmarks/ endpoint returns 200 with JSON response
- [ ] Response includes all top-level bookmarks
- [ ] Nested bookmark groups show children in `items` array
- [ ] Each bookmark includes: id, type, title, ctime
- [ ] Empty bookmark list returns `{"bookmarks": []}`
- [ ] Response time <100ms for vaults with <1000 bookmarks

**API Contract**:
```json
GET /bookmarks/
Response 200:
{
  "bookmarks": [
    {
      "id": "bookmark-123",
      "type": "file",
      "title": "My Note",
      "path": "folder/note.md",
      "ctime": 1234567890
    },
    {
      "id": "group-456",
      "type": "group",
      "title": "Research",
      "items": [
        { "id": "bookmark-789", "type": "folder", ... }
      ]
    }
  ]
}
```

---

### BKM-R2: API consumer distinguishes 8 bookmark types through structured response

**Who**: External API consumer processing bookmarks
**Current State**: No type information available
**Target State**: Each bookmark clearly identifies its type with type-specific properties
**Value**: Enables type-aware bookmark processing (different handling for files vs URLs)

**Acceptance Criteria**:
- [ ] All 8 types supported: file, folder, heading, block, search, graph, url, group
- [ ] File bookmarks include `path` property
- [ ] Folder bookmarks include `path` property
- [ ] Heading bookmarks include `path` and heading reference
- [ ] Block bookmarks include `path` and block reference
- [ ] Search bookmarks include search query
- [ ] Graph bookmarks include graph type/settings
- [ ] URL bookmarks include `url` property
- [ ] Group bookmarks include `items` array

**Validation**: Test suite covers response structure for each bookmark type

---

### BKM-TECH2: System handles missing/disabled bookmark plugin gracefully

**Who**: System reliability (prevents 500 errors)
**Current State**: Unknown behavior when plugin unavailable
**Target State**: Clear 405 error when plugin disabled
**Value**: Better error messages, no plugin-related crashes

**Acceptance Criteria**:
- [ ] GET /bookmarks/ returns 405 with error code 40501 when plugin disabled
- [ ] Error message: "Bookmarks plugin is not enabled"
- [ ] POST /bookmarks/ returns same error when plugin disabled
- [ ] All bookmark endpoints check plugin state before operations
- [ ] Tests verify error handling with mocked disabled plugin

**Measurement**: Zero 500 errors related to bookmark plugin state

---

## Core Write Capabilities

### BKM-W1: API consumer creates file/folder bookmarks in single request

**Who**: External API consumer adding bookmarks programmatically
**Current State**: No programmatic bookmark creation
**Target State**: POST /bookmarks/ creates file or folder bookmark
**Value**: Enables automated bookmark creation from external tools

**Acceptance Criteria**:
- [ ] POST /bookmarks/ with type=file creates file bookmark
- [ ] POST /bookmarks/ with type=folder creates folder bookmark
- [ ] Request validates required fields (type, path)
- [ ] Response returns 201 with new bookmark id
- [ ] Title auto-derived from filename if not provided
- [ ] Invalid file path returns 404 error
- [ ] Duplicate bookmark detection (same path) returns 409 conflict

**API Contract**:
```json
POST /bookmarks/
Request:
{
  "type": "file",
  "path": "notes/important.md",
  "title": "Important Note"  // optional
}
Response 201:
{
  "id": "bookmark-new-123",
  "message": "Bookmark created successfully"
}
```

---

### BKM-W2: API consumer organizes bookmarks into nested groups

**Who**: External API consumer organizing bookmark hierarchy
**Current State**: Flat bookmark creation only
**Target State**: Create groups and add bookmarks to specific groups
**Value**: Enables complex bookmark organization via API

**Acceptance Criteria**:
- [ ] POST /bookmarks/ with type=group creates bookmark group
- [ ] Request with `parentId` places bookmark inside group
- [ ] Nested groups supported (groups within groups)
- [ ] Invalid `parentId` returns 404 error
- [ ] Group title required (no auto-derivation)
- [ ] Empty groups allowed

**API Contract**:
```json
POST /bookmarks/
Request:
{
  "type": "group",
  "title": "Research Papers"
}
Response 201:
{
  "id": "group-xyz",
  "message": "Bookmark group created successfully"
}

POST /bookmarks/
Request:
{
  "type": "file",
  "path": "research/paper1.md",
  "parentId": "group-xyz"
}
```

---

### BKM-W3: API consumer bookmarks special content (headings/blocks/searches)

**Who**: External API consumer creating advanced bookmarks
**Current State**: Only file/folder bookmarks supported
**Target State**: Support heading, block, search, graph, and URL bookmarks
**Value**: Full feature parity with Obsidian UI bookmark capabilities

**Acceptance Criteria**:
- [ ] POST with type=heading creates heading bookmark (requires path + heading)
- [ ] POST with type=block creates block bookmark (requires path + block ID)
- [ ] POST with type=search creates search bookmark (requires query)
- [ ] POST with type=graph creates graph bookmark (requires graph settings)
- [ ] POST with type=url creates URL bookmark (requires url field)
- [ ] Each type validates type-specific required fields
- [ ] Invalid heading/block references return 404

**API Contract**:
```json
POST /bookmarks/
Request (heading):
{
  "type": "heading",
  "path": "notes/doc.md",
  "heading": "Introduction"
}

Request (block):
{
  "type": "block",
  "path": "notes/doc.md",
  "blockId": "abc123"
}

Request (url):
{
  "type": "url",
  "url": "https://example.com",
  "title": "Example Site"
}
```

---

### BKM-TECH3: System validates bookmark data before Obsidian API calls

**Who**: System reliability (data integrity)
**Current State**: Unknown validation behavior
**Target State**: All inputs validated before plugin API calls
**Value**: Prevents corrupt bookmark data, clear error messages

**Acceptance Criteria**:
- [ ] Type validation: only 8 allowed types accepted
- [ ] Required field validation per bookmark type
- [ ] Path validation: file/folder exists in vault
- [ ] URL validation: valid URL format for url bookmarks
- [ ] Parent ID validation: group exists before nesting
- [ ] Input sanitization: prevent injection attacks
- [ ] Error code 40010 for invalid type
- [ ] Error code 40011 for missing required fields

**Measurement**: 100% of invalid inputs rejected with clear error codes

---

## Core Modification Capabilities

### BKM-M1: API consumer renames bookmarks without losing hierarchy

**Who**: External API consumer updating bookmark metadata
**Current State**: No bookmark update capability
**Target State**: PATCH /bookmarks/:id updates bookmark title
**Value**: Enables bookmark management workflows

**Acceptance Criteria**:
- [ ] PATCH /bookmarks/:id with `title` field updates bookmark title
- [ ] Bookmark remains in same position in hierarchy
- [ ] All bookmark types support title updates
- [ ] Empty title returns 400 error
- [ ] Invalid bookmark ID returns 404
- [ ] Response returns 200 with success message

**API Contract**:
```json
PATCH /bookmarks/bookmark-123/
Request:
{
  "title": "Updated Title"
}
Response 200:
{
  "message": "Bookmark updated successfully"
}
```

---

### BKM-M2: API consumer reorganizes bookmark structure by moving items

**Who**: External API consumer restructuring bookmarks
**Current State**: No move capability
**Target State**: PATCH with `parentId` moves bookmark to different group
**Value**: Enables dynamic bookmark organization

**Acceptance Criteria**:
- [ ] PATCH with `parentId` moves bookmark to specified group
- [ ] PATCH with `parentId: null` moves bookmark to root level
- [ ] Moving to invalid group returns 404
- [ ] Can't move group into itself (circular reference check)
- [ ] Can't move group into its own descendant
- [ ] Bookmark retains all properties during move

**API Contract**:
```json
PATCH /bookmarks/bookmark-123/
Request:
{
  "parentId": "group-xyz"
}
Response 200:
{
  "message": "Bookmark moved successfully"
}
```

---

### BKM-M3: API consumer removes bookmarks and groups cleanly

**Who**: External API consumer managing bookmark lifecycle
**Current State**: No delete capability
**Target State**: DELETE /bookmarks/:id removes bookmark
**Value**: Complete bookmark CRUD operations

**Acceptance Criteria**:
- [ ] DELETE /bookmarks/:id removes bookmark
- [ ] Deleting group removes all nested bookmarks recursively
- [ ] Invalid bookmark ID returns 404
- [ ] Response returns 200 or 204
- [ ] Deleted bookmarks don't appear in subsequent GET requests

**API Contract**:
```json
DELETE /bookmarks/bookmark-123/
Response 204: (no content)
```

---

### BKM-TECH4: System prevents orphaned bookmarks during group operations

**Who**: System reliability (data consistency)
**Current State**: Unknown behavior when deleting groups
**Target State**: Safe group deletion with cascade or prevention
**Value**: No corrupt bookmark data, predictable behavior

**Acceptance Criteria**:
- [ ] Deleting group with children requires recursive flag OR returns error
- [ ] Recursive delete removes all descendants
- [ ] Moving bookmarks out of group updates parent references correctly
- [ ] Tests verify no orphaned bookmarks after complex operations
- [ ] Plugin state remains consistent after errors

**Measurement**: Zero orphaned bookmarks in integration tests

---

## Quality & Production Readiness

### BKM-Q1: Developer catches bookmark regressions through automated tests

**Who**: Developer maintaining bookmark feature
**Current State**: No test coverage
**Target State**: Comprehensive test suite covering all bookmark operations
**Value**: Prevents regressions, enables confident refactoring

**Acceptance Criteria**:
- [ ] Test coverage ≥90% for bookmark-related code
- [ ] Tests cover all 8 bookmark types
- [ ] Tests cover error conditions (plugin disabled, invalid inputs)
- [ ] Tests cover hierarchy operations (nested groups, moves)
- [ ] Tests use mocked bookmark plugin (no real Obsidian instance needed)
- [ ] All tests pass before merging to main
- [ ] Test suite runs in <10 seconds

**Test Categories**:
- Unit tests: Helper methods, validation logic
- Integration tests: Full endpoint request/response cycles
- Error handling tests: All error codes verified
- Edge case tests: Empty lists, deeply nested groups, circular references

---

### BKM-Q2: API consumer understands bookmark endpoints through OpenAPI docs

**Who**: External API consumer (developer reading docs)
**Current State**: No documentation for bookmark endpoints
**Target State**: Complete OpenAPI specification with examples
**Value**: Reduces support burden, enables self-service integration

**Acceptance Criteria**:
- [ ] OpenAPI paths added for all 5 bookmark endpoints
- [ ] Request/response schemas defined for all bookmark types
- [ ] Example requests shown for each bookmark type
- [ ] Error codes documented with descriptions
- [ ] Authentication requirements specified
- [ ] Documentation builds without errors (`npm run build-docs`)
- [ ] Swagger UI displays bookmark endpoints correctly

**Documentation Sections**:
- Bookmark types reference table
- Common error codes
- Hierarchy operations guide
- Example workflows (create group → add bookmarks → reorganize)

---

### BKM-TECH5: Team deploys bookmark feature without breaking existing endpoints

**Who**: Team deploying feature to production
**Current State**: Feature on branch, not merged
**Target State**: Feature merged to main, all tests pass
**Value**: Feature available to users, no production issues

**Acceptance Criteria**:
- [ ] All bookmark tests pass (npm test)
- [ ] All existing tests still pass (regression check)
- [ ] Build completes successfully (npm run build)
- [ ] Documentation builds successfully (npm run build-docs)
- [ ] Code review completed with approval
- [ ] No breaking changes to existing endpoints
- [ ] Git commits follow atomic commit pattern

**Pre-merge Checklist**:
- [ ] Branch rebased on latest main
- [ ] Commit history clean and reviewable
- [ ] CHANGELOG.md updated with new endpoints
- [ ] Version number bumped appropriately
