# Implementation Notes - File Operations API

## Architecture Decisions

### 1. API Method Choice: PATCH vs WebDAV MOVE

After extensive research into REST conventions for file operations, we discovered:

- **WebDAV Standard**: Defines a `MOVE` HTTP method specifically for moving/renaming resources
- **Modern APIs**: 
  - Google Drive uses `PATCH /files/{id}` with JSON body
  - Dropbox uses `POST /files/move_v2` with path parameters
- **Express.js Limitation**: Doesn't natively support custom HTTP methods like MOVE

We chose to use PATCH because:
1. It maintains consistency with existing content modification operations
2. Works with all HTTP clients without special configuration
3. The operation conceptually "patches" the file's metadata (its location)
4. Express.js routing works seamlessly with standard HTTP methods

### 2. Operation Design: Separate Rename vs Move

**Critical Decision**: Keep rename and move as distinct operations with clear semantics.

- **Rename** (`Target: name`): Changes only the filename within the same directory
- **Move** (`Target: path`): Changes the full path, potentially moving between directories

This separation is crucial because:
1. The implications are very different (local rename vs cross-directory move)
2. Prevents ambiguous operations that could be misinterpreted
3. Makes the API intent explicit and self-documenting
4. Aligns with how users think about these operations

### 3. Using Obsidian's fileManager.renameFile()

Research revealed that Obsidian internally uses a single method for both operations:
```typescript
app.fileManager.renameFile(file: TAbstractFile, newPath: string): Promise<void>
```

This method:
- Handles both rename and move by changing the path
- Automatically updates all internal links
- Preserves file history and metadata
- Is the recommended approach over `vault.rename()` which has link update issues

### 4. Error Handling Strategy

Comprehensive error handling was implemented:
- **404**: Source file not found
- **409**: Destination already exists (prevents accidental overwrites)
- **400**: Various validation errors with specific messages
- **500**: Operation failures with detailed error messages

### 5. Directory Creation for Moves

When moving files, parent directories are automatically created if they don't exist. This matches user expectations from file managers and prevents common errors.

## Implementation Timeline

- **2025-01-19 14:27**: Initial rename functionality implementation
- **2025-01-19 17:57**: Extended to support move operations
- **No prior support**: Before this date, PATCH only supported content operations (heading, block, frontmatter)

## Future Considerations

### 1. WebDAV MOVE Support

While not implemented, future versions could add proper WebDAV MOVE support:
```javascript
app.all('*', (req, res, next) => {
  if (req.method === 'MOVE') {
    // Handle MOVE with Destination header
  }
});
```

### 2. Batch Operations

Could extend to support multiple file operations:
```json
POST /batch/move
{
  "operations": [
    {"source": "file1.md", "destination": "folder/file1.md"},
    {"source": "file2.md", "destination": "folder/file2.md"}
  ]
}
```

### 3. Operation Aliases

Considered adding `Operation: move` as a more semantic alternative to `replace`, but decided against it to maintain simplicity and avoid confusion with content operations.

## Security Considerations

1. **Path Traversal**: The implementation relies on Obsidian's internal validation to prevent path traversal attacks
2. **Overwrite Protection**: Explicitly checks for existing files to prevent accidental data loss
3. **Atomic Operations**: Uses Obsidian's atomic rename to prevent partial state

## Testing Strategy

Comprehensive test script (`test-move-api.sh`) covers:
1. Basic file creation
2. Move to subfolder with auto-creation
3. Verification of successful move
4. Confirmation of removal from original location
5. Simple rename within same directory
6. Cleanup of test files

## Lessons Learned

1. **Research First**: Understanding existing standards (WebDAV) and modern implementations (Google, Dropbox) informed better design decisions
2. **Semantic Clarity**: Clear separation of operations prevents ambiguity and improves API usability
3. **Work Within Constraints**: Using PATCH creatively while acknowledging it's not semantically perfect
4. **Leverage Platform**: Using Obsidian's built-in methods ensures consistency with the application's behavior