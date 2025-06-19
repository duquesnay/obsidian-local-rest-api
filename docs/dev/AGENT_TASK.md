# Fix Obsidian Local REST API Rename Endpoint

You are starting in the obsidian-local-rest-api directory. Your task is to fix the rename endpoint implementation to work with the expected API contract.

## Initial Setup
Start by running `/init` to understand the codebase structure and dependencies.

## Current Problem
The rename endpoint is returning error 400 with message: "The 'Target-Type' header you provided was invalid."

## API Contract (DO NOT CHANGE)
The mcp-obsidian client expects this exact contract:

**Endpoint**: `PATCH /vault/{filepath}`

**Headers**:
- `Authorization: Bearer {api_key}`
- `Content-Type: text/plain`
- `Operation: replace`
- `Target-Type: file`
- `Target: name`

**Body**: New filename only (not full path)
- Example: To rename `folder/old-file.md` to `folder/new-file.md`, send body: `new-file.md`

**Expected Responses**:
- `200 OK` - Success with JSON: `{"message": "File successfully renamed", "oldPath": "...", "newPath": "..."}`
- `404 Not Found` - Source file doesn't exist  
- `409 Conflict` - Destination file already exists

## The Issue
The validation rejects `Target-Type: file` as invalid. Valid values are only: heading, block, frontmatter.

## Investigation Steps
1. Run `/init` to explore the codebase
2. Find where Target-Type validation occurs (likely in src/requestHandler.ts)
3. Locate any existing rename endpoint implementation
4. Understand the validation flow and how to bypass/extend it

## Fix Required
You need to ensure rename operations work by EITHER:

### Option 1: Add 'file' to valid Target-Type enum
- Find the OpenAPI schema or validation code
- Add 'file' as a valid Target-Type value
- Ensure the PATCH handler recognizes and processes file operations

### Option 2: Intercept before validation
- Check if rename operations can be handled before standard PATCH validation
- Look for early request handling in the middleware chain
- Implement special case for Operation=replace, Target-Type=file, Target=name

## Implementation Requirements
The rename handler MUST:
1. Extract new filename from request body (plain text)
2. Parse directory from the original filepath in URL
3. Construct new full path: `${directory}/${newFilename}`
4. Use `app.fileManager.renameFile(oldFile, newPath)` for proper Obsidian integration
5. Return appropriate HTTP status and JSON response
6. Handle edge cases (file not found, destination exists, etc.)

## Build and Test
After fixing:
1. Build: `npm run build`
2. The built file will be at `main.js`
3. Reload plugin using methods in CLAUDE.md
4. Test with: `/Users/guillaume/Dev/tools/mcp-obsidian/test_rename_endpoint.py`

## Success Criteria
The test script should output:
```
✅ SUCCESS! The rename endpoint is working!
✅ Renamed file exists!
✅ Test file deleted
```

## Important Notes
- The API contract CANNOT be changed - mcp-obsidian is already implemented
- Focus on making the REST API plugin accept this exact contract
- The FileManager API automatically handles link updates
- Check existing rename implementation referenced in CLAUDE.md

Start with `/init` to begin exploring the codebase.