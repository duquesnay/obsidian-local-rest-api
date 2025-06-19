# File Operations API Documentation

The Obsidian Local REST API provides powerful file operation capabilities through the PATCH endpoint, including renaming and moving files while preserving their history, metadata, and automatically updating all internal links.

## Overview

File operations are performed using the PATCH method on the `/vault/{filepath}` endpoint with specific headers to indicate the operation type.

## Rename Operation

To rename a file while keeping it in the same directory:

### Request
```http
PATCH /vault/folder/old-name.md
Authorization: Bearer {API_KEY}
Content-Type: text/plain
Operation: rename
Target-Type: file
Target: name

new-name.md
```

### Response (200 OK)
```json
{
  "message": "File successfully renamed",
  "oldPath": "folder/old-name.md",
  "newPath": "folder/new-name.md"
}
```

## Move Operation

To move a file to a different location in your vault. This operation can also rename the file during the move.

### Request
```http
PATCH /vault/old-folder/file.md
Authorization: Bearer {API_KEY}
Content-Type: text/plain
Operation: move
Target-Type: file
Target: path

new-folder/subfolder/file.md
```

### Response (200 OK)
```json
{
  "message": "File successfully moved",
  "oldPath": "old-folder/file.md",
  "newPath": "new-folder/subfolder/file.md"
}
```

## Important Distinctions

- **Rename** (`Target: name`): Changes only the filename, file remains in the same directory
- **Move** (`Target: path`): Changes the complete path, can move file to different directories and optionally rename

The `move` operation is more powerful as it can:
1. Move a file to a different directory (keeping the same name)
2. Move a file to a different directory with a new name
3. "Rename" a file by keeping it in the same directory but changing its name

These are intentionally separate operations to ensure clear intent, with `rename` being a convenience operation for the common case of changing only the filename.

## Features

- **Link Preservation**: All internal links to the moved/renamed file are automatically updated
- **History Preservation**: Git history and file metadata are maintained
- **Directory Creation**: Parent directories are automatically created if they don't exist
- **Atomic Operation**: The operation either completes fully or fails without partial changes

## Error Handling

### Common Error Responses

#### File Not Found (404)
```json
{
  "errorCode": 40400,
  "message": "File not found"
}
```

#### Destination Already Exists (409)
```json
{
  "errorCode": 40901,
  "message": "Destination file already exists"
}
```

#### Invalid Request (400)
Various 400 errors for invalid paths or missing parameters:
```json
{
  "errorCode": 40001,
  "message": "New path is required in request body"
}
```

```json
{
  "errorCode": 40002,
  "message": "newPath must be a file path, not a directory"
}
```

```json
{
  "errorCode": 40003,
  "message": "Invalid Target value for file operations. Use 'name' for rename or 'path' for move"
}
```

## Examples

### Example 1: Simple Rename
Rename `meeting-notes.md` to `2024-01-15-meeting.md`:

```bash
curl -X PATCH https://localhost:27124/vault/meeting-notes.md \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: text/plain" \
  -H "Operation: rename" \
  -H "Target-Type: file" \
  -H "Target: name" \
  -d "2024-01-15-meeting.md"
```

### Example 2: Move to Subfolder
Move `draft.md` to `posts/2024/draft.md`:

```bash
curl -X PATCH https://localhost:27124/vault/draft.md \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: text/plain" \
  -H "Operation: move" \
  -H "Target-Type: file" \
  -H "Target: path" \
  -d "posts/2024/draft.md"
```

### Example 3: Move and Rename
Move `temp/notes.md` to `archive/2024-01-notes.md`:

```bash
curl -X PATCH https://localhost:27124/vault/temp/notes.md \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: text/plain" \
  -H "Operation: move" \
  -H "Target-Type: file" \
  -H "Target: path" \
  -d "archive/2024-01-notes.md"
```

## Implementation Notes

The file operations use Obsidian's internal `FileManager.renameFile()` method, which ensures:
- All links are updated according to user preferences
- File history is preserved (important for version control)
- Metadata and properties are maintained
- The operation is atomic and consistent

## API Design

This API uses semantic operations (`rename` and `move`) with the PATCH method:
1. Clear intent through operation names
2. Unambiguous separation between rename (filename only) and move (full path)
3. Works within Express.js constraints (no custom HTTP methods)
4. Consistent with the existing PATCH infrastructure for content modifications

## Testing

A test script is provided at `test-move-api.sh` to verify the functionality:

```bash
export OBSIDIAN_API_KEY="your-api-key"
./test-move-api.sh
```

This script tests:
1. Creating a test file
2. Moving the file to a subfolder
3. Verifying the file exists at the new location
4. Confirming the file is removed from the old location
5. Testing the rename operation