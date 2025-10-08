# Bookmarks API Design

## Overview
REST API endpoints for managing Obsidian bookmarks (files, folders, headings, blocks, searches, graphs, URLs).

## Research Findings

### Obsidian Bookmarks
- Internal core plugin (undocumented API)
- Accessible via `app.internalPlugins.plugins.bookmarks.instance`
- Bookmark types: file, folder, heading, block, search, graph, URL
- Hierarchical structure with bookmark groups/folders
- Each bookmark has: id, type, title, path (for files/folders), and other type-specific properties

### API Access Pattern
Since bookmarks is an internal plugin, we'll access it via:
```typescript
const bookmarksPlugin = this.app.internalPlugins.plugins.bookmarks;
if (!bookmarksPlugin || !bookmarksPlugin.enabled) {
  // Return error: bookmarks plugin not enabled
}
const bookmarks = bookmarksPlugin.instance;
```

## Endpoint Design

Following existing patterns in `/tags/` and `/commands/` endpoints.

### GET /bookmarks/
List all bookmarks with groups/folders structure.

**Response:**
```json
{
  "bookmarks": [
    {
      "id": "bookmark-id",
      "type": "file|folder|heading|block|search|graph|url",
      "title": "Display title",
      "path": "path/to/file.md",  // for file/folder types
      "ctime": 1234567890,
      "items": []  // for groups/folders containing nested bookmarks
    }
  ]
}
```

### POST /bookmarks/
Create a new bookmark or bookmark group.

**Request Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "type": "file|folder|heading|block|search|graph|url|group",
  "title": "Optional display title",
  "path": "path/to/resource",  // required for most types
  "parentId": "optional-parent-group-id"
}
```

**Response:** `201 Created`
```json
{
  "id": "new-bookmark-id",
  "message": "Bookmark created successfully"
}
```

### PATCH /bookmarks/:id/
Update an existing bookmark.

**Request Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "title": "New title",
  "path": "new/path",  // if moving
  "parentId": "new-parent-id"  // if moving to different group
}
```

**Response:** `200 OK`

### DELETE /bookmarks/:id/
Remove a bookmark or bookmark group.

**Response:** `200 OK` or `204 No Content`

## Error Codes

Following existing error code patterns:

- `40501`: Bookmarks plugin not enabled
- `40460`: Bookmark not found
- `40010`: Invalid bookmark type
- `40011`: Missing required fields

## Implementation Strategy

### Phase 1: Read Operations (MVP)
1. GET /bookmarks/ - List all bookmarks
2. Add type definitions for bookmark structures
3. Helper methods to access bookmark plugin
4. Comprehensive tests

### Phase 2: Write Operations
1. POST /bookmarks/ - Create bookmark
2. Tests for creation

### Phase 3: Update/Delete Operations
1. PATCH /bookmarks/:id/ - Update bookmark
2. DELETE /bookmarks/:id/ - Delete bookmark
3. Tests for update/delete

### Phase 4: Advanced Features (Optional)
- Query parameters for filtering by type
- Nested bookmark operations
- Bulk operations

## Technical Considerations

### TypeScript Definitions
Need to augment existing types in `src/types.ts`:

```typescript
export interface BookmarkItem {
  id: string;
  type: 'file' | 'folder' | 'heading' | 'block' | 'search' | 'graph' | 'url' | 'group';
  title: string;
  path?: string;
  ctime?: number;
  items?: BookmarkItem[];  // for groups
}
```

### Testing Strategy
- Mock the bookmarks internal plugin instance
- Test with various bookmark types
- Test hierarchical structures
- Test error conditions (plugin disabled, bookmark not found)

## Following Project Patterns

1. **Route registration**: Add to `setupRouter()` similar to tags pattern
2. **Error handling**: Use `returnCannedResponse()` for consistent error responses
3. **Authentication**: Handled by existing middleware
4. **Method naming**: `bookmarksGet`, `bookmarksPost`, `bookmarkGet`, `bookmarkPatch`, `bookmarkDelete`
5. **TDD approach**: Write tests first
6. **Atomic commits**: Test infrastructure → helpers → endpoints → routes → docs
