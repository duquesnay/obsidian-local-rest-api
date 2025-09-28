# New Features Changelog

## Version 4.0.0 (2025-09-28) ✅

### Bug Fixes
- **Fixed empty directory listing** - GET `/vault/{path}/` now properly includes empty directories using adapter.list() method
- **Updated OpenAPI documentation** - Corrected directory listing description to reflect that empty directories are now returned
- **Empty directories display** - Empty directories now show with trailing slash in listing response

### Documentation Updates
- Updated OpenAPI version to 4.0.0
- Updated backlog management in CLAUDE.md with completed items and future priorities

## Recent Enhancements (claude-dev branch)

### Phase 1: Tag Management ✅
- **GET /tags/** - List all tags in the vault with usage counts
- **GET /tags/{tagname}/** - Get all files containing a specific tag
- **PATCH /tags/{tagname}/** - Rename a tag across the entire vault
- **PATCH /vault/{filepath}** with `Target-Type: tag` - Add or remove tags from individual files

### Phase 2: Advanced Search ✅
- **POST /search/advanced/** - Multi-criteria search with:
  - Content search (text queries and regex patterns)
  - Frontmatter field filtering
  - File metadata filters (path, size, dates)
  - Tag filtering (include/exclude/any)
  - Pagination and sorting
  - Configurable context extraction

### Phase 3: File Information Access ✅
- **GET /vault/{path}** enhanced with content negotiation:
  - Accept headers for different formats
  - Query parameter `?format=` support
  - New content types:
    - `application/vnd.olrapi.metadata+json` - Metadata without content
    - `application/vnd.olrapi.frontmatter+json` - Just the frontmatter
    - `text/plain` - Content without frontmatter
    - `text/html` - Basic HTML rendering

## API Examples

### Advanced Search Example
```bash
curl -X POST https://localhost:27124/search/advanced/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "query": "project management",
      "caseSensitive": false
    },
    "frontmatter": {
      "status": "active",
      "priority": { "$gt": 5 }
    },
    "metadata": {
      "path": "projects/**/*.md",
      "modifiedAfter": "2024-01-01"
    },
    "tags": {
      "include": ["work"],
      "exclude": ["archived"]
    },
    "pagination": {
      "page": 1,
      "limit": 20
    },
    "options": {
      "sortBy": "modified",
      "sortOrder": "desc",
      "contextLength": 100
    }
  }'
```

### Content Negotiation Examples
```bash
# Get only metadata (no content)
curl https://localhost:27124/vault/my-note.md \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: application/vnd.olrapi.metadata+json"

# Get only frontmatter
curl https://localhost:27124/vault/my-note.md?format=frontmatter \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get HTML rendered version
curl https://localhost:27124/vault/my-note.md?format=html \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get plain text without frontmatter
curl https://localhost:27124/vault/my-note.md?format=plain \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Tag Management Examples
```bash
# List all tags
curl https://localhost:27124/tags/ \
  -H "Authorization: Bearer YOUR_API_KEY"

# Rename a tag
curl -X PATCH https://localhost:27124/tags/old-tag/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-New-Tag-Name: new-tag"

# Add tag to a file
curl -X PATCH https://localhost:27124/vault/my-note.md \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Target-Type: tag" \
  -H "Target: important" \
  -H "Operation: add"
```

## Benefits for Automation

1. **Efficient Data Access**: Request only the data you need (metadata, frontmatter, or content)
2. **Powerful Search**: Find notes using multiple criteria in a single request
3. **Bulk Operations**: Rename tags across entire vault in one operation
4. **Format Flexibility**: Get content in the format that best suits your use case
5. **Token Optimization**: For LLM integrations, request metadata-only to save tokens

## Upcoming Features (Planned)

- Phase 4: Link Graph Operations (analyze note connections)
- Phase 5: Batch Processing (multiple operations in single request)

## Testing

All features include comprehensive test coverage. Run tests with:
```bash
npm test
```