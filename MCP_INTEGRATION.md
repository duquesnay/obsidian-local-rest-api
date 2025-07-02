# MCP Integration Guide for Obsidian Local REST API

## New Features Available (v3.3.0+)

### 1. Advanced Search (Phase 2)
**Endpoint**: `POST /search/advanced/`

Search with multiple criteria including content, frontmatter, metadata, and tags.

**Example Request**:
```json
{
  "content": {
    "query": "project management",
    "caseSensitive": false
  },
  "frontmatter": {
    "status": "active"
  },
  "tags": {
    "include": ["work", "important"]
  }
}
```

### 2. Content Negotiation (Phase 3)
**Endpoint**: `GET /vault/{path}`

Retrieve files in different formats using Accept headers or query parameters.

**Formats**:
- `application/vnd.olrapi.note+json` - Full metadata with content
- `application/vnd.olrapi.metadata+json` - Metadata only (no content)
- `application/vnd.olrapi.frontmatter+json` - Frontmatter only
- `text/plain` - Content without frontmatter
- `text/html` - HTML rendered markdown

**Examples**:
```bash
# Get metadata only
curl -H "Accept: application/vnd.olrapi.metadata+json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     https://localhost:27124/vault/my-note.md

# Or using query parameter
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://localhost:27124/vault/my-note.md?format=metadata
```

### 3. Tag Management (Phase 1)
**Endpoints**:
- `GET /tags/` - List all tags in vault
- `GET /tags/{tagname}/` - Get files with specific tag
- `PATCH /tags/{tagname}/` - Rename tag across vault
- `PATCH /vault/{filepath}` with `Target-Type: tag` - Add/remove tags from files

## MCP Server Configuration

If you're building an MCP server wrapper for this REST API, you can expose these as MCP resources or tools:

### As MCP Resources
```json
{
  "resources": [
    {
      "uri": "obsidian://search/advanced",
      "name": "Advanced Search",
      "description": "Search notes with multiple criteria",
      "mimeType": "application/json"
    },
    {
      "uri": "obsidian://vault/{path}?format={format}",
      "name": "Note Content",
      "description": "Get note in various formats",
      "mimeType": "varies"
    }
  ]
}
```

### As MCP Tools
```json
{
  "tools": [
    {
      "name": "obsidian_search_advanced",
      "description": "Search Obsidian vault with advanced filters",
      "inputSchema": {
        "type": "object",
        "properties": {
          "content": {
            "type": "object",
            "properties": {
              "query": { "type": "string" },
              "regex": { "type": "string" },
              "caseSensitive": { "type": "boolean" }
            }
          },
          "frontmatter": { "type": "object" },
          "tags": {
            "type": "object",
            "properties": {
              "include": { "type": "array", "items": { "type": "string" } },
              "exclude": { "type": "array", "items": { "type": "string" } }
            }
          }
        }
      }
    },
    {
      "name": "obsidian_get_note",
      "description": "Get note content in specified format",
      "inputSchema": {
        "type": "object",
        "required": ["path"],
        "properties": {
          "path": { "type": "string" },
          "format": {
            "type": "string",
            "enum": ["full", "metadata", "frontmatter", "plain", "html"],
            "default": "full"
          }
        }
      }
    }
  ]
}
```

## Integration Example

Here's how an MCP server might wrap these endpoints:

```typescript
// Example MCP server implementation
class ObsidianMCPServer {
  async handleTool(name: string, args: any) {
    const apiKey = process.env.OBSIDIAN_API_KEY;
    const baseUrl = 'https://localhost:27124';
    
    switch(name) {
      case 'obsidian_search_advanced':
        const response = await fetch(`${baseUrl}/search/advanced/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(args)
        });
        return await response.json();
        
      case 'obsidian_get_note':
        const { path, format = 'full' } = args;
        const headers = {
          'Authorization': `Bearer ${apiKey}`
        };
        
        // Set appropriate Accept header based on format
        switch(format) {
          case 'metadata':
            headers['Accept'] = 'application/vnd.olrapi.metadata+json';
            break;
          case 'frontmatter':
            headers['Accept'] = 'application/vnd.olrapi.frontmatter+json';
            break;
          // ... etc
        }
        
        const noteResponse = await fetch(`${baseUrl}/vault/${path}`, { headers });
        return await noteResponse.json();
    }
  }
}
```

## Benefits for Claude Code

With these new features, Claude Code can:

1. **Search more intelligently**: Use advanced search to find notes by content, metadata, tags, or any combination
2. **Get just what's needed**: Request only metadata or frontmatter to reduce token usage
3. **Work with different formats**: Get HTML for preview, plain text for analysis, or full JSON for complete access
4. **Manage tags programmatically**: Rename tags across the entire vault, add/remove tags from files

## Testing the Integration

You can test these features directly:

```bash
# Test advanced search
curl -X POST https://localhost:27124/search/advanced/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": {"query": "test"},
    "tags": {"include": ["important"]}
  }'

# Test content negotiation
curl https://localhost:27124/vault/my-note.md?format=metadata \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Version Requirements

- Obsidian Local REST API: v3.3.0 or higher
- These features are available in the `claude-dev` branch and will be in the next release