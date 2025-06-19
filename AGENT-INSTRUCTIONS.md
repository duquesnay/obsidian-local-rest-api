# Agent Instructions for Parallel Development

## Quick Start Guide

### Agent 1: Append Content Investigation
```bash
# Navigate to your worktree
cd .worktrees/append-bug

# Check what you're working on
cat ../../WORKTREE-STATUS.md

# Install dependencies (if needed)
npm install

# Run your test script
../../scripts/agent-tests/test-append.sh

# Run existing tests
npm test -- --testNamePattern="vaultPost"
```

**Your Task**: Investigate the reported append_content failure. The user says it doesn't work after PATCH API changes, but suspect the server-side is actually fine.

**Investigation Steps**:
1. Test the POST endpoint directly with the test script
2. Check if PATCH changes affected POST routing
3. Run existing POST tests
4. Compare POST and PATCH handlers for conflicts

**Expected Discovery**: The API server is working fine - the issue is likely client-side.

### Agent 2: Move Enhancement
```bash
# Navigate to your worktree
cd .worktrees/move-enhance

# Check what you're working on
cat ../../WORKTREE-STATUS.md

# Install dependencies (if needed)
npm install

# Run your test script
../../scripts/agent-tests/test-move.sh

# Run existing tests
npm test -- --testNamePattern="move"
```

**Your Task**: Enhance the move endpoint we just implemented with better error handling and validation.

**Enhancement Areas**:
1. Input validation (paths, filenames)
2. Better error messages
3. Edge cases (special characters, long paths)
4. Performance optimizations
5. Usage examples and documentation

## Coordination Rules

### File Ownership (Current)
- **Agent 1**: Focus on POST/append logic in requestHandler.ts
- **Agent 2**: Focus on handleRenameOperation method in requestHandler.ts
- **Both**: Update WORKTREE-STATUS.md when claiming specific methods/sections

### Communication Protocol
1. **Before starting**: Update status in WORKTREE-STATUS.md
2. **When claiming files**: Add specific methods/sections you're working on
3. **When done**: Mark complete and commit your changes
4. **If conflicts**: Coordinate via WORKTREE-STATUS.md comments

### Git Workflow
```bash
# Check status
git status

# Make changes
# ... do your work ...

# Commit in your worktree
git add .
git commit -m "feat/fix: Your changes"

# Push your branch (when ready)
git push origin your-branch-name

# Create PR when complete
```

## Available Tools

### Test Scripts
- `scripts/agent-tests/test-append.sh` - Test append functionality
- `scripts/agent-tests/test-move.sh` - Test move functionality
- `scripts/test/test-api.sh` - General API tests

### Development Scripts
- `scripts/dev/dev-watch.sh` - Auto-rebuild on changes
- `scripts/dev/obsidian-launcher.sh` - Launch Obsidian with logging

### Debugging
- `scripts/debug/reload-plugin.js` - Manual plugin reload
- `scripts/debug/test-hot-reload.js` - Test hot reload status

## Expected Outcomes

### Agent 1 Should Discover
- POST endpoint works fine
- No conflicts with PATCH changes
- Issue is likely in the client (mcp-obsidian)
- Report: "Server-side append is working correctly"

### Agent 2 Should Deliver
- Enhanced move endpoint with better validation
- Improved error messages
- Additional test cases
- Usage examples or documentation

## Success Metrics
- Both agents work without stepping on each other
- Clean commits with focused changes
- Issues resolved/enhancements delivered
- Learning about what coordination is actually needed