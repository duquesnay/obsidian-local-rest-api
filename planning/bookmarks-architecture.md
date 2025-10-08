# Bookmarks API - Final Architecture Specification

**Author**: solution-architect
**Date**: 2025-10-08
**Status**: Approved for implementation

## Executive Summary

Pragmatic hybrid approach using URL-encoded paths as resource identifiers (matching Obsidian's internal system) with enhanced responses for developer experience.

## Key Decisions

### 1. Resource Identification: URL-Encoded Path as ID
- **Pattern**: `/bookmarks/{url-encoded-path}`
- **Rationale**: Matches Obsidian's `bookmarkLookup` system, consistent with vault endpoints
- **Example**: `GET /bookmarks/daily%2F2025-01-01.md`

### 2. Response Format: Enhanced with Title Generation
- Add `title` field via `getItemTitle()` for DX
- Use `path` field as identifier (no synthetic ID)
- One-time generation cost negligible for typical bookmark counts

### 3. Groups Handling: Recursive Enhancement
- Assume `items?: BookmarkItem[]` for nested groups
- Defensive checks with validation in Phase 2
- Fallback: Remove recursive logic if structure differs

## API Endpoints Specification

### GET /bookmarks/
List all bookmarks with hierarchy.

**Response**:
```json
{
  "bookmarks": [
    {
      "path": "daily/2025-01-01.md",
      "type": "file",
      "title": "Daily Note - 2025-01-01",
      "ctime": 1704067200000
    }
  ]
}
```

**Query Parameters**:
- `?type=file` - Filter by bookmark type
- `?flat=true` - Flatten groups to single array

**Error Responses**:
- `503` - Bookmarks plugin disabled

### GET /bookmarks/{path}
Get single bookmark by path.

**Response (200)**:
```json
{
  "path": "daily/2025-01-01.md",
  "type": "file",
  "title": "Daily Note - 2025-01-01",
  "ctime": 1704067200000
}
```

**Error Responses**:
- `404` - Bookmark not found

### POST /bookmarks/
Create new bookmark.

**Request Body**:
```json
{
  "type": "file",
  "path": "projects/new-project.md"
}
```

**Supported Types**: file, folder, heading, block, search, url, group

**Response (201)**:
```json
{
  "path": "projects/new-project.md",
  "type": "file",
  "title": "New Project",
  "ctime": 1704067200000
}
```

**Error Responses**:
- `400` - Invalid bookmark data (missing type/path)
- `409` - Bookmark already exists

### PATCH /bookmarks/{path}
Update existing bookmark (partial updates supported).

**Request Body**:
```json
{
  "path": "projects/renamed-project.md"
}
```

**Response (200)**: Updated bookmark

**Error Responses**:
- `404` - Bookmark not found
- `409` - Path conflict (when renaming to existing path)

### DELETE /bookmarks/{path}
Remove bookmark.

**Response**: `204 No Content`

**Error Responses**:
- `404` - Bookmark not found

## Implementation Guide

### Helper Methods

#### getBookmarksPlugin()
```typescript
private getBookmarksPlugin(): BookmarksPluginInstance | null {
  const bookmarksPlugin = this.app.internalPlugins.plugins.bookmarks;
  if (!bookmarksPlugin?.enabled) return null;
  return bookmarksPlugin.instance;
}
```

#### enhanceBookmark()
```typescript
private enhanceBookmark(item: BookmarkItem): BookmarkResponse {
  const instance = this.app.internalPlugins.plugins.bookmarks.instance;

  const enhanced: BookmarkResponse = {
    path: item.path,
    type: item.type,
    title: instance.getItemTitle(item),
    ctime: item.ctime
  };

  // Recursive enhancement for groups
  if (item.type === 'group' && item.items) {
    enhanced.items = item.items.map(child => this.enhanceBookmark(child));
  }

  return enhanced;
}
```

### Route Registration

**Critical**: Place BEFORE `/vault/*` wildcard to avoid routing conflicts.

```typescript
// Bookmarks endpoints
this.router.get("/bookmarks/", this.handleGetAllBookmarks.bind(this));
this.router.post("/bookmarks/", this.handleCreateBookmark.bind(this));
this.router.get("/bookmarks/:path", this.handleGetBookmark.bind(this));
this.router.patch("/bookmarks/:path", this.handleUpdateBookmark.bind(this));
this.router.delete("/bookmarks/:path", this.handleDeleteBookmark.bind(this));
```

### Error Handling Pattern

Use existing `returnCannedResponse()`:
```typescript
// Plugin disabled
this.returnCannedResponse(response, 503, "Bookmarks plugin disabled",
  "The Obsidian bookmarks plugin is not enabled");

// Not found
this.returnCannedResponse(response, 404, "Bookmark not found",
  `No bookmark exists with path: ${decodedPath}`);

// Validation error
this.returnCannedResponse(response, 400, "Invalid bookmark data",
  "Missing required fields: type and path");

// Conflict
this.returnCannedResponse(response, 409, "Bookmark already exists",
  `Bookmark with path '${path}' already exists`);
```

## Integration Points

### Similar Patterns

**Vault Endpoints** (path as identifier):
```
GET    /vault/{path}    →  GET    /bookmarks/{path}
PATCH  /vault/{path}    →  PATCH  /bookmarks/{path}
DELETE /vault/{path}    →  DELETE /bookmarks/{path}
```

**Tags API** (enhanced responses):
```
GET /tags/               // Returns tags with usage counts
GET /bookmarks/          // Returns bookmarks with titles
```

## Risk Mitigation

### Groups Structure Unknown
- **Assume**: `items?: BookmarkItem[]` property
- **Validate**: Test with manual group creation
- **Fallback**: Remove recursive logic if needed

### Path Encoding Edge Cases
- Paths with `#`: `file.md#Heading`
- Paths with `^`: `file.md#^blockid`
- URL bookmarks: `https://example.com/page`
- **Solution**: Standard `encodeURIComponent()` / `decodeURIComponent()`

### editItem() Semantics
- **Question**: Supports partial updates?
- **Approach**: PATCH does merge before calling `editItem()`
- **Test**: Validate in development vault

## Testing Strategy

### Unit Tests
- GET /bookmarks/ - all bookmarks with titles
- GET /bookmarks/ - filter by type
- GET /bookmarks/:path - with special characters
- POST /bookmarks/ - various types
- POST /bookmarks/ - validation errors (400)
- POST /bookmarks/ - duplicate path (409)
- PATCH /bookmarks/:path - partial updates
- PATCH /bookmarks/:path - path conflict (409)
- DELETE /bookmarks/:path - success (204)
- All endpoints - plugin disabled (503)

### Integration Tests
Script: `scripts/test/test-bookmarks-api.sh`
- End-to-end CRUD operations
- Path encoding validation
- Error scenarios

## Phase 1 Implementation Steps

1. Add TypeScript types to `src/types.ts`
2. Add helper methods to `src/requestHandler.ts`
3. Implement GET /bookmarks/ handler (TDD)
4. Implement GET /bookmarks/:path handler (TDD)
5. Implement POST /bookmarks/ handler (TDD)
6. Implement PATCH /bookmarks/:path handler (TDD)
7. Implement DELETE /bookmarks/:path handler (TDD)
8. Register routes in setupRouter()
9. Run all tests (green line required)
10. Create integration test script

## Acceptance Criteria

- [ ] All 5 endpoints implemented and tested
- [ ] Unit tests pass (100% handler coverage)
- [ ] Integration tests pass
- [ ] Error responses use returnCannedResponse
- [ ] Routes registered before /vault/* wildcard
- [ ] Path encoding/decoding works
- [ ] Plugin disabled returns 503
- [ ] No breaking changes to existing endpoints

## Estimated Complexity

- **Implementation**: 4-6 hours
- **Testing**: 2 hours
- **Documentation**: 1 hour
- **Total**: 7-9 hours

## Next Steps

1. Developer: Implement Phase 1 endpoints
2. Integration-Specialist: Validate API contracts
3. Solution-Architect: Review Phase 2 group findings
