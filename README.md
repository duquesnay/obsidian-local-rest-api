# Local REST API for Obsidian

Turn your Obsidian vault into a powerful REST API server. Automate note management, search content, and integrate with external tools through a secure HTTPS interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

### Core Functionality
- **Full CRUD Operations**: Read, create, update, and delete notes via REST API
- **Advanced Search**: Multi-criteria search with content, metadata, tags, and frontmatter filtering
- **Tag Management**: List, rename, and manage tags across your entire vault
- **Directory Operations**: Create, move, copy, and delete folders with automatic link updates
- **Content Negotiation**: Get notes in multiple formats (JSON, HTML, plain text, metadata-only)
- **Periodic Notes**: Create and manage daily, weekly, monthly notes
- **Command Execution**: Trigger any Obsidian command via API

### Security
- HTTPS by default with self-signed certificates
- API key authentication with SHA-256 hashing
- Configurable authentication requirements
- Path traversal protection

## Installation

### From Obsidian Community Plugins
1. Open Obsidian Settings → Community Plugins
2. Search for "Local REST API"
3. Click Install, then Enable

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/coddingtonbear/obsidian-local-rest-api/releases)
2. Extract files to your vault's `.obsidian/plugins/obsidian-local-rest-api/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Quick Start

### 1. Get Your API Key
1. Open Obsidian Settings → Local REST API
2. Copy your API key (or generate a new one)

### 2. Test the Connection
```bash
# Test without authentication (only endpoint that doesn't require auth)
curl -k https://localhost:27124/

# Test with authentication
curl -k -H "Authorization: Bearer YOUR_API_KEY" https://localhost:27124/vault/
```

### 3. Basic Operations

#### Create a Note
```bash
curl -X PUT https://localhost:27124/vault/my-note.md \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: text/markdown" \
  -d "# My Note\n\nThis is my note content"
```

#### Read a Note
```bash
curl -k https://localhost:27124/vault/my-note.md \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Update a Note (Insert at Heading)
```bash
curl -X PATCH https://localhost:27124/vault/my-note.md \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: text/markdown" \
  -H "Heading: My Section" \
  -d "New content to insert"
```

## Documentation

### API Documentation
Visit https://coddingtonbear.github.io/obsidian-local-rest-api/ for interactive Swagger documentation.

### Architecture & Development
- [Architecture Review & Roadmap](docs/architecture/ROADMAP.md) - Refactoring plan and architecture analysis
- [Development Guidelines](CLAUDE.md) - Development practices and project learnings
- [MCP Integration](MCP_INTEGRATION.md) - Model Context Protocol integration guide

### Key Endpoints

#### Notes
- `GET /vault/` - List all notes
- `GET /vault/{path}` - Read a note (supports content negotiation)
- `PUT /vault/{path}` - Create/update a note
- `DELETE /vault/{path}` - Delete a note
- `PATCH /vault/{path}` - Modify note content/metadata

#### Search
- `GET /search/simple/?query={query}` - Simple text search
- `POST /search/advanced/` - Advanced multi-criteria search

#### Tags
- `GET /tags/` - List all tags with counts
- `GET /tags/{tagname}/` - Get files with specific tag
- `PATCH /tags/{tagname}/` - Rename tag across vault

#### Directories
- `POST /vault/{path}` with `Target-Type: directory` - Create directory
- `DELETE /vault/{path}` with `Target-Type: directory` - Delete directory
- `PATCH /vault/{path}` with `Target-Type: directory` - Move directory

#### Commands
- `GET /commands/` - List available commands
- `POST /commands/{commandId}/` - Execute command

## Advanced Examples

### Advanced Search
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
    "tags": {
      "include": ["work"],
      "exclude": ["archived"]
    }
  }'
```

### Content Negotiation
```bash
# Get only metadata (no content)
curl https://localhost:27124/vault/my-note.md?format=metadata \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get HTML rendered version
curl https://localhost:27124/vault/my-note.md \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: text/html"
```

### Tag Management
```bash
# Rename a tag across entire vault
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

## Development

### Prerequisites
- Node.js 16+
- npm or yarn
- Obsidian app for testing

### Setup
```bash
# Clone the repository
git clone https://github.com/coddingtonbear/obsidian-local-rest-api.git
cd obsidian-local-rest-api

# Install dependencies
npm install

# Build for development (with hot reload)
npm run dev

# Build for production
npm run build
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch
```

### Development Tools
- `scripts/dev/dev-watch.sh` - Auto-rebuild on file changes
- `scripts/dev/obsidian-launcher.sh` - Launch Obsidian with enhanced logging
- Hot Reload plugin recommended for faster development

### Project Structure
```
├── src/
│   ├── main.ts          # Plugin entry point
│   ├── requestHandler.ts # Express server & API endpoints
│   ├── api.ts           # Extension API for other plugins
│   └── types.ts         # TypeScript definitions
├── __tests__/           # Jest test files
├── docs/                # API documentation
└── scripts/             # Development scripts
```

## Configuration

### Plugin Settings
Access via Obsidian Settings → Local REST API:

- **API Key**: Your authentication token
- **Enable Request Logging**: Log all API requests
- **HTTPS Port**: Default 27124
- **HTTP Port**: Default 27123 (optional)
- **Enable CORS**: For browser-based access

### SSL Certificates
The plugin generates self-signed certificates on first run. To avoid browser warnings:
1. Export the certificate from plugin settings
2. Add to your system's trusted certificates

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Commit Convention
We use conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring

### Code Style
- TypeScript with strict mode
- ESLint configuration included
- Run `npm run lint` before committing

## Troubleshooting

### Common Issues

#### Certificate Warnings
- This is normal with self-signed certificates
- Add certificate to trusted certificates or use `-k` flag with curl

#### Plugin Not Loading
1. Check Obsidian console (Ctrl/Cmd + Shift + I)
2. Ensure all files are in `.obsidian/plugins/obsidian-local-rest-api/`
3. Try reloading Obsidian

#### API Connection Refused
- Check if plugin is enabled
- Verify correct port (default: 27124)
- Check firewall settings

### Debug Mode
Enable request logging in plugin settings to see all API requests in Obsidian's developer console.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Credits

Created by [coddingtonbear](https://github.com/coddingtonbear). Inspired by [Vinzent03](https://github.com/Vinzent03)'s [advanced-uri plugin](https://github.com/Vinzent03/obsidian-advanced-uri).
Augmented by [duquesnay](http://https://github.com/duquesnay)

## Links

- [Interactive API Documentation](https://coddingtonbear.github.io/obsidian-local-rest-api/)
- [GitHub Repository](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Report Issues](https://github.com/coddingtonbear/obsidian-local-rest-api/issues)
- [Obsidian Forum Thread](https://forum.obsidian.md/)
