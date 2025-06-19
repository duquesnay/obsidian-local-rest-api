# Development Log - File Operations API

## Date: 2025-01-19

### Overview
Today we implemented file rename and move operations for the Obsidian Local REST API plugin. This was a new feature - prior to this, the PATCH endpoint only supported content operations on headings, blocks, and frontmatter.

### Key Discoveries

1. **No prior file operation support**: Before today, the Target-Type enum only included `["heading", "block", "frontmatter"]`. The "file" target type was completely new.

2. **Obsidian's API**: Research revealed that Obsidian uses a single method `app.fileManager.renameFile()` for both rename and move operations. This method:
   - Preserves file history and metadata
   - Automatically updates all internal links
   - Works by changing the file path (same directory = rename, different directory = move)

### Implementation Details

#### 1. Added handleRenameOperation Method

```typescript
async handleRenameOperation(
  path: string,
  req: express.Request,
  res: express.Response
): Promise<void> {
  // Validates the file path
  if (!path || path.endsWith("/")) {
    this.returnCannedResponse(res, {
      errorCode: ErrorCode.RequestMethodValidOnlyForFiles,
    });
    return;
  }

  // Determines operation type from Target header
  const target = req.get("Target");
  const isMove = target === "path";
  const isRename = target === "name";
  
  if (!isMove && !isRename) {
    res.status(400).json({
      errorCode: 40003,
      message: "Invalid Target value for file operations. Use 'name' for rename or 'path' for move"
    });
    return;
  }

  // Gets new value from request body
  const newValue = typeof req.body === 'string' ? req.body.trim() : '';
  
  // For rename: constructs new path in same directory
  // For move: uses the provided path directly
  let newPath: string;
  if (isRename) {
    const dirPath = path.substring(0, path.lastIndexOf('/'));
    newPath = dirPath ? `${dirPath}/${newValue}` : newValue;
  } else {
    newPath = newValue;
  }

  // Validates source exists and destination doesn't
  const sourceFile = this.app.vault.getAbstractFileByPath(path);
  if (!sourceFile || !(sourceFile instanceof TFile)) {
    this.returnCannedResponse(res, { statusCode: 404 });
    return;
  }

  const destExists = await this.app.vault.adapter.exists(newPath);
  if (destExists) {
    res.status(409).json({
      errorCode: 40901,
      message: "Destination file already exists"
    });
    return;
  }

  // Creates parent directories for move operations
  if (isMove) {
    const parentDir = newPath.substring(0, newPath.lastIndexOf('/'));
    if (parentDir) {
      try {
        await this.app.vault.createFolder(parentDir);
      } catch {
        // Folder might already exist
      }
    }
  }

  // Performs the operation
  try {
    await this.app.fileManager.renameFile(sourceFile, newPath);
    
    res.status(200).json({
      message: isMove ? "File successfully moved" : "File successfully renamed",
      oldPath: path,
      newPath: newPath
    });
  } catch (error) {
    res.status(500).json({
      errorCode: 50001,
      message: `Failed to ${isMove ? 'move' : 'rename'} file: ${error.message}`
    });
  }
}
```

#### 2. Modified _vaultPatchV3 Method

Added a check for file operations before the standard validation:

```typescript
// Check for file-level operations (like rename) BEFORE validation
if (targetType === "file" && operation === "replace") {
  if (rawTarget === "name" || rawTarget === "path") {
    return this.handleRenameOperation(path, req, res);
  }
}

// Updated the valid target types to include "file"
if (!["heading", "block", "frontmatter", "file"].includes(targetType)) {
  this.returnCannedResponse(res, {
    errorCode: ErrorCode.InvalidTargetTypeHeader,
  });
  return;
}
```

### API Design Decisions

1. **Why PATCH instead of WebDAV MOVE?**
   - Express.js doesn't natively support custom HTTP methods like MOVE
   - PATCH was already used for content modifications
   - Wanted to maintain consistency with existing API patterns
   - The operation semantically "patches" the file's metadata (its path/name)

2. **Why "replace" operation?**
   - Limited by the external `markdown-patch` library which defines operations as: append, prepend, replace
   - "Replace" was chosen to mean "replace the file's path/name"
   - Acknowledged this isn't perfectly semantic but works within constraints

3. **Clear separation of rename vs move**
   - `Target: name` - Only changes filename, stays in same directory
   - `Target: path` - Changes full path, can move between directories
   - Prevents ambiguous operations that could be misinterpreted

### Git Commits Made

1. **09f474d** - "feat: Add file rename endpoint with PATCH /vault/{filepath}"
   - Initial implementation of rename functionality
   - Added Target-Type: file with Target: name

2. **a487ed5** - "feat: Add move file endpoint to PATCH /vault/{filepath}"
   - Extended to support move operations
   - Added Target: path option
   - Updated OpenAPI documentation

### Testing Approach

Created `test-move-api.sh` script that tests:
1. Creating a test file
2. Moving file to a subfolder
3. Verifying file exists at new location
4. Confirming file removed from old location
5. Testing rename operation within same directory

### Future Considerations

1. **Potential WebDAV MOVE support**: Could be added using Express middleware to handle custom HTTP methods
2. **Operation naming**: Considered using "move" instead of "replace" but decided against breaking changes
3. **Batch operations**: Could support moving/renaming multiple files in one request