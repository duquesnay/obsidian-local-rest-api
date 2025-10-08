# Bookmarks Plugin Investigation Spike

**Date**: 2025-10-07
**Duration**: 30 minutes (time-boxed)
**Goal**: Understand Obsidian's internal bookmarks plugin API structure to inform implementation

## Investigation Method

Since the bookmarks plugin is internal and undocumented, we need to:
1. Examine the plugin structure via TypeScript types
2. Test with Obsidian developer console
3. Compare with similar internal plugin integrations in codebase

## Findings

### 1. Plugin Access Pattern (from types.ts)

```typescript
app.internalPlugins.plugins[key]: {
  instance: { ... }
}
```

The bookmark plugin should be accessible as:
```typescript
app.internalPlugins.plugins.bookmarks.instance
```

### 2. Console Investigation Commands

To run in Obsidian Developer Console (Cmd+Option+I):

```javascript
// Check if plugin exists and is enabled
const bookmarksPlugin = app.internalPlugins.plugins.bookmarks;
console.log('Plugin:', bookmarksPlugin);
console.log('Enabled:', bookmarksPlugin?.enabled);

// Examine the instance structure
const instance = bookmarksPlugin?.instance;
console.log('Instance:', instance);
console.log('Instance keys:', Object.keys(instance || {}));

// Look at bookmark items
console.log('Items:', instance?.items);

// Check for methods
console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));

// Examine a single bookmark structure
if (instance?.items?.length > 0) {
  console.log('Sample bookmark:', JSON.stringify(instance.items[0], null, 2));
}
```

### 3. Expected Bookmark Structure (Hypothesis)

Based on design document and common patterns:

```typescript
interface BookmarkItem {
  id: string;                    // Unique identifier
  type: 'file' | 'folder' | ... // Bookmark type
  title: string;                 // Display name
  path?: string;                 // For file/folder types
  ctime?: number;               // Creation timestamp
  items?: BookmarkItem[];       // For groups (nested)

  // Type-specific fields (to be discovered):
  // - heading: { path, heading }
  // - block: { path, blockId }
  // - search: { query }
  // - graph: { ... }
}
```

### 4. Plugin Methods (Hypothesis)

Based on typical CRUD operations:

```typescript
interface BookmarksPluginInstance {
  items: BookmarkItem[];         // All bookmarks

  // Expected methods (to be verified):
  addItem(item: BookmarkItem): void | string;
  removeItem(id: string): void;
  updateItem(id: string, updates: Partial<BookmarkItem>): void;
  getItem(id: string): BookmarkItem | null;

  // Possibly:
  save(): void;                  // Persist changes
  load(): void;                  // Reload from storage
}
```

## Risks Identified

### HIGH RISK
1. **Undocumented API**: Internal plugin API may change without notice
2. **Unknown methods**: May not have expected CRUD methods
3. **Storage mechanism**: Don't know how changes are persisted

### MEDIUM RISK
4. **Type variations**: Different bookmark types may have varying structures
5. **ID generation**: Unknown how bookmark IDs are created
6. **Validation**: Unknown what constraints exist (max depth, title length, etc.)

### LOW RISK
7. **Performance**: Large bookmark collections may have performance implications
8. **Events**: May or may not have change events/callbacks

## Next Steps

### Immediate (After Console Investigation)
1. Run console commands in live Obsidian instance
2. Document actual structure in this file
3. Update TypeScript interfaces based on findings
4. Identify any show-stoppers (missing APIs, read-only access, etc.)

### If API is Accessible
- Proceed with Phase 1 implementation (BKM-TECH1, BKM-R1)
- Use discovered structure for TypeScript types
- Mock actual methods in tests

### If API is Limited/Missing
- Consult solution-architect on alternative approaches:
  - File system access to bookmark storage file
  - Fallback to read-only operations
  - Documentation-only approach with manual setup required

## Spike Results

### Actual Plugin Structure

**Plugin Instance Keys**:
```javascript
[
    "_",                      // Internal state
    "id",                     // Plugin ID
    "name",                   // Plugin name
    "description",            // Plugin description
    "defaultOn",              // Default enabled state
    "hasValidData",           // Data validation flag
    "items",                  // ⭐ Main bookmark array
    "bookmarkLookup",         // ID-based lookup cache
    "urlBookmarkLookup",      // URL-based lookup cache
    "bookmarkedViews",        // Active view tracking
    "onItemsChanged",         // Change event handler
    "app",                    // App reference
    "plugin"                  // Plugin reference
]
```

### Actual Bookmark Item Structure

**Simple Bookmark** (file/folder):
```json
{
  "type": "folder",
  "ctime": 1716625331149,
  "path": "Menuiserie"
}
```

**Key Findings**:
- Bookmarks do NOT have an `id` field (unexpected!)
- Items appear to be identified by `type` + `path` combination
- No `title` field - title likely derived from path
- No hierarchical `items` array in flat structure (groups may be different type)

### Available Methods

**CRUD Operations** (✅ Available):
- `addItem()` - Create bookmark
- `editItem()` - Update bookmark
- `removeItem()` - Delete bookmark
- `moveItem()` - Reorder/reorganize

**Query Operations**:
- `getBookmarks()` - Retrieve bookmarks (better than direct `items` access)
- `getItemTitle()` - Get display title for bookmark
- `findBookmarkByView()` - Find bookmark for active view

**Internal Operations**:
- `saveData()` - Persist changes
- `loadData()` - Reload from storage
- `rebuildBookmarkCache()` - Rebuild lookup indices
- `_onItemsChanged()` - Trigger change events

**Cache/Lookup**:
- `bookmarkLookup` - Fast ID-based lookups
- `urlBookmarkLookup` - Fast URL-based lookups

### Critical Discoveries

1. **No Bookmark IDs**: Bookmarks don't have explicit `id` fields
   - Likely identified by composite key (`type` + `path`)
   - May use internal cache for lookups (`bookmarkLookup`)

2. **Full CRUD API Available**: All expected methods exist
   - `addItem()`, `editItem()`, `removeItem()`, `moveItem()`
   - No show-stoppers for write operations

3. **Change Persistence**:
   - `saveData()` suggests automatic persistence
   - `_onItemsChanged()` event system for reactivity

4. **Title Generation**:
   - `getItemTitle()` method suggests titles derived from paths
   - May need to call this for display names

5. **Flat Structure Observed**:
   - Sample shows flat array, not hierarchical
   - Need to investigate how groups/folders are represented
   - May be separate `type: "group"` with nested `items` array

### Show-stoppers Found
- [x] None - proceed with implementation
- [ ] Limited API - adjust scope
- [ ] No programmatic access - pivot approach

### Confidence Level
- [x] HIGH - Clear API, proceed as designed
- [ ] MEDIUM - Workable API, minor adjustments needed
- [ ] LOW - Significant unknowns remain, need more investigation

**Rationale**: Full CRUD API available, clear data structure, caching built-in

## Decision

**Proceed with**: Phase 1 (Read operations)

**Reasoning**:
- All required methods exist (`getBookmarks()`, `addItem()`, `editItem()`, `removeItem()`)
- Data structure is simpler than expected (no explicit IDs)
- Built-in caching (`bookmarkLookup`) may help with performance

**Adjustments to Design**:
1. **No ID field**: Use composite key `type:path` or investigate `bookmarkLookup` structure
2. **Title handling**: Use `getItemTitle()` method instead of `title` field
3. **Groups investigation**: Need to check if groups exist and how they're structured

**Next action**:
1. ✅ Investigate `bookmarkLookup` structure for ID system
2. ✅ Test if groups/nested bookmarks exist in sample data
3. Consult solution-architect on ID strategy
4. Begin Phase 1 implementation

### ID System Investigation Results

**Key Discovery**: `bookmarkLookup` uses `path` as the unique identifier (dictionary key)

```javascript
bookmarkLookup: {
    "Menuiserie": { type: "folder", ctime: ..., path: "Menuiserie" },
    "Code/AI/Projets Code.md": { type: "file", ctime: ..., path: "Code/AI/Projets Code.md" },
    // ...
}
```

**Findings**:
1. **Path is the ID**: Bookmarks are uniquely identified by their `path` field
2. **Fast lookups**: `bookmarkLookup` provides O(1) access by path
3. **No groups found**: Current vault has no bookmark groups (flat structure)
4. **Simple structure**: Just `type`, `ctime`, and `path` fields

**API Design Implications**:
1. Use `path` as the `:id` parameter in REST endpoints
   - GET `/bookmarks/:path/` where path is the bookmark path
   - PATCH `/bookmarks/:path/`
   - DELETE `/bookmarks/:path/`
2. URL encoding required for paths with special characters
3. Groups may have different structure (need to investigate when found)
4. Title generation via `getItemTitle()` method confirmed necessary

---

## Learnings for Future Spikes

- Time-boxing worked: [Yes/No]
- Console investigation method: [Effective/Needs improvement]
- Documentation approach: [Clear/Needs refinement]
