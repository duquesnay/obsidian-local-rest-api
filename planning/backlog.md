# Product Backlog

**Unified priority list**: Bugs and features ordered by real value and urgency
**Current focus**: Bookmarks API + Critical bug fixes

---

## Priority-Ordered Work List

### CRITICAL BUGS (Must fix before new features)

- [x] BUG-PATH1: Third-party plugins access files without trailing slash errors
  - **Issue**: GET /vault/file.md/ returns 404 (trailing slash interpreted as directory)
  - **Impact**: favorite-note plugin crashes with "Cannot read properties of null (reading 'classList')"
  - **Root cause**: Path normalization missing for file requests with trailing slashes
  - **Solution**: Strip trailing slashes before processing file paths
  - **Acceptance**:
    - /vault/file.md/ and /vault/file.md return same result
    - Integration test verifies path normalization
    - Third-party plugins work with trailing slashes
  - **Estimate**: 30min (path normalization + tests)
  - **Priority**: HIGH (breaks plugin ecosystem integration)
  - **Completed**: 2025-10-08
  - **Commit**: 116da98
  - **Test Coverage**: 186 tests passing
  - **Breaking Changes**: ZERO

---

## Bookmarks API Feature Backlog

**Feature**: REST API for Obsidian bookmark management
**Branch**: feat/bookmarks-api
**Priority**: HIGH
**Status**: Design complete, implementation pending

### Critical Foundation (BLOCKING - Must complete first)
- [ ] BKM-TECH1: System routes bookmark requests without /vault/* conflicts
  - **CRITICAL**: Routes must register BEFORE /vault/* wildcard
  - **Acceptance**: Integration test verifies bookmarks routes precede vault wildcard
  - **Estimate**: 30min (routing + validation test)
  - **Blocks**: ALL endpoint implementations

- [ ] BKM-TECH2: Developer accesses bookmark data without plugin API crashes
  - **Defensive coding**: Try-catch in enhanceBookmark(), fallback to path-as-title
  - **Plugin validation**: Check getItemTitle() method exists before use
  - **Acceptance**: Graceful degradation when plugin API changes
  - **Estimate**: 45min (defensive patterns + validation)

### Core Read Capabilities (Phase 1 - MVP)
- [ ] BKM-R1: API consumer retrieves bookmark list with hierarchy intact
  - **Endpoint**: GET /bookmarks/
  - **Response**: Enhanced with titles via getItemTitle()
  - **Path encoding**: URL-encoded paths as identifiers
  - **Query params**: ?type=file, ?flat=true
  - **Acceptance**: Returns all bookmarks with titles, handles path encoding edge cases (/, #, ^)
  - **Estimate**: 2h (handler + tests)
  - **Dependencies**: BKM-TECH1 (route order), BKM-TECH2 (defensive access)

- [ ] BKM-R2: API consumer retrieves single bookmark by path
  - **Endpoint**: GET /bookmarks/{url-encoded-path}
  - **Path decoding**: decodeURIComponent(req.params.path)
  - **Error handling**: 404 if not found, 503 if plugin disabled
  - **Acceptance**: Path encoding works for special characters (/, #, ^)
  - **Estimate**: 1h (handler + edge case tests)

- [ ] BKM-TECH3: System handles missing/disabled bookmark plugin gracefully
  - **Error pattern**: 503 via returnCannedResponse()
  - **Message**: "Bookmarks plugin disabled"
  - **Acceptance**: All endpoints return 503 when plugin unavailable
  - **Estimate**: 30min (consistent error handling)

### Core Write Capabilities (Phase 2)
- [ ] BKM-W1: API consumer creates file/folder bookmarks in single request
  - **Endpoint**: POST /bookmarks/
  - **Request**: { type, path }
  - **Supported types**: file, folder, heading, block, search, url, group
  - **Validation**: 400 for missing fields, 409 for duplicates
  - **Acceptance**: Creates bookmark and returns enhanced response (201)
  - **Estimate**: 2h (handler + validation tests)

- [ ] BKM-W2: API consumer organizes bookmarks into nested groups
  - **Enhancement**: Recursive enhanceBookmark() for groups
  - **Defensive check**: Array.isArray(item.items) before recursion
  - **Acceptance**: Groups show nested structure, fails gracefully if structure differs
  - **Estimate**: 1.5h (recursive logic + edge cases)

- [ ] BKM-W3: API consumer bookmarks special content (headings/blocks/searches)
  - **Types**: heading (#), block (^), search
  - **Path format**: file.md#Heading, file.md#^blockid
  - **Acceptance**: All special types create and retrieve correctly
  - **Estimate**: 1h (type-specific tests)

- [ ] BKM-TECH4: System validates bookmark data before Obsidian API calls
  - **Validation**: Required fields, type enum, path format
  - **Error pattern**: 400 with specific validation errors
  - **Acceptance**: Invalid requests rejected before plugin API calls
  - **Estimate**: 1h (validation layer)

### Core Modification Capabilities (Phase 3)
- [ ] BKM-M1: API consumer updates bookmark properties
  - **Endpoint**: PATCH /bookmarks/{path}
  - **Partial updates**: Merge request with existing bookmark
  - **Validation**: 404 if not found, 409 if path conflict
  - **Acceptance**: Updates work, path renaming handled
  - **Estimate**: 2h (merge logic + conflict handling)

- [ ] BKM-M2: API consumer removes bookmarks cleanly
  - **Endpoint**: DELETE /bookmarks/{path}
  - **Response**: 204 No Content on success
  - **Acceptance**: Removes bookmark, returns 404 if not found
  - **Estimate**: 1h (handler + tests)

- [ ] BKM-TECH5: System prevents orphaned bookmarks during group operations
  - **Group deletion**: Validate child bookmark handling
  - **Move operations**: Maintain hierarchy integrity
  - **Acceptance**: No orphaned bookmarks after group operations
  - **Estimate**: 1.5h (group operation edge cases)

### Quality & Production Readiness
- [ ] BKM-Q1: Developer catches bookmark regressions through automated tests
  - **P0 tests**: Route order, auth, path encoding, plugin disabled
  - **P1 tests**: CORS, error format, backward compatibility
  - **Integration matrix**: All endpoint × scenario combinations
  - **Acceptance**: All P0+P1 tests pass, 100% handler coverage
  - **Estimate**: 3h (comprehensive test suite)

- [ ] BKM-Q2: API consumer understands bookmark endpoints through OpenAPI docs
  - **Documentation**: All 5 endpoints with examples
  - **Response schemas**: Match implementation
  - **Error codes**: Documented with descriptions
  - **Acceptance**: OpenAPI spec complete and accurate
  - **Estimate**: 1.5h (spec + examples)

- [ ] BKM-TECH6: Team deploys v4.1.0 without breaking existing endpoints
  - **Version bump**: 4.0.1 → 4.1.0 (new feature, non-breaking)
  - **Integration validation**: All existing endpoint tests pass
  - **Acceptance**: Zero breaking changes confirmed
  - **Estimate**: 30min (version + validation)

---

## Implementation Summary

**Total Items**: 15 capabilities
**Technical Capabilities**: 6 (BKM-TECH1-6)
**User-Facing Capabilities**: 9 (BKM-R1-2, BKM-W1-3, BKM-M1-2, BKM-Q1-2)
**Technical Investment Ratio**: 40% (6/15) - Yellow Zone (new feature integration with undocumented API)

**Total Estimate**: 18.5 hours
- Foundation: 1.25h (BLOCKING)
- Phase 1 (Read): 3.5h
- Phase 2 (Write): 5.5h
- Phase 3 (Modify): 4.5h
- Quality: 4.5h

## Critical Dependencies

**BKM-TECH1 BLOCKS ALL IMPLEMENTATIONS** - Route order must be correct before any endpoint work begins.

**Dependency Chain**:
1. BKM-TECH1 (route order) → Enables all endpoints
2. BKM-TECH2 (defensive access) → Enables safe plugin interaction
3. BKM-R1, BKM-R2 (read endpoints) → Foundation for testing write operations
4. BKM-W1, BKM-W2, BKM-W3 (write endpoints) → Enable modification testing
5. BKM-M1, BKM-M2 (modify endpoints) → Complete CRUD operations

## Integration Validation Summary

**Status**: ✅ APPROVED - SAFE TO IMPLEMENT (95% confidence)
**Breaking Changes**: ZERO confirmed
**Version**: 4.0.1 → 4.1.0 (new feature, non-breaking)

**Critical Mitigations Applied**:
- Route registration order enforcement (BKM-TECH1)
- Defensive plugin API access (BKM-TECH2)
- Path encoding edge case handling (all endpoints)
- Fallback mechanisms for API changes (enhanceBookmark)

**Unknown Risks**:
- Groups structure (`items?: BookmarkItem[]`) - mitigated with defensive checks
- `getItemTitle()` method signature - mitigated with try-catch fallback
- Performance with >1000 bookmarks - documented for Phase 2 pagination
