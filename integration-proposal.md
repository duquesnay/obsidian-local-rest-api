# Integration Proposal: Learnings to Parent CLAUDE.md Files

## Analysis Summary
Analyzed learnings from the Obsidian Local REST API project. Key patterns identified:
- Shell script patterns to avoid permission prompts
- Electron/plugin development challenges
- Hot reload troubleshooting with cache issues
- Development workflow improvements

## Proposed Additions

### 1. Global CLAUDE.md (`~/.claude/CLAUDE.md`)

#### Location: After "Claude Code Permission Workarounds" section
```markdown
### Shell Script Pattern for Complex Commands
When working with commands that include pipes, redirects, or multiple operators:

1. **Create reusable shell scripts** instead of inline commands
2. **For one-time tasks**, reuse existing scripts with different arguments
3. **Store scripts in a `scripts/` directory** organized by purpose:
   - `scripts/dev/` - Development utilities
   - `scripts/test/` - Test harnesses
   - `scripts/debug/` - Debugging tools

Example transformation:
```bash
# Instead of:
curl -k https://api.example.com | jq '.data[]' | grep pattern

# Create script:
#!/bin/bash
# scripts/test/api-query.sh
curl -k "$1" > /tmp/api-result.json
jq "$2" /tmp/api-result.json | grep "$3"
```

This pattern prevents permission fatigue and makes commands maintainable.
```

#### Location: Add new section "Electron & Plugin Development"
```markdown
## Electron & Plugin Development

### Console Logging Challenges
- **Startup logs are often hidden**: Constructor and initialization logs may not appear in standard output
- **Use Developer Console**: Cmd+Option+I (macOS) or Ctrl+Shift+I (Windows/Linux)
- **Only runtime logs appear in files**: Post-initialization logs show up in log files

### Hot Reload Troubleshooting
1. **Manual reload often required**: Don't rely on automatic file watchers
2. **Check for cached versions**: Applications may cache old plugin versions
   - Clear app cache if seeing old code after reload
   - Look for backup files in cache directories
3. **Implement multiple reload methods**:
   - Command palette triggers
   - API endpoints
   - Developer console scripts

### Plugin Reload Pattern
```javascript
// Developer Console reload script
async function reloadPlugin(pluginId) {
    await app.plugins.disablePlugin(pluginId);
    await new Promise(r => setTimeout(r, 100));
    await app.plugins.enablePlugin(pluginId);
    console.log('Plugin reloaded!');
}
```
```

### 2. Project-Level CLAUDE.md (`/Users/guillaume/Dev/tools/mcp-obsidian/CLAUDE.md`)

#### Location: Add to "Common Development Tasks" section
```markdown
### Obsidian Plugin Development Specifics

#### Cache Issues with Hot Reload
- **CRITICAL**: Obsidian may cache plugin backups in its cache folders
- Hot reload may load cached versions instead of your edited files
- If seeing old code after reload, clear Obsidian's cache

#### File Operations
- Always use `app.fileManager` API for file operations
- This ensures proper link updates and vault indexing
- Direct file operations bypass Obsidian's internal tracking

#### Testing Workflow
```bash
# Build and deploy
npm run build
cp main.js /path/to/vault/.obsidian/plugins/plugin-name/

# Trigger reload (multiple methods)
# 1. Command Palette: "Hot Reload: Check for plugin changes"
# 2. API: curl -k -X POST https://127.0.0.1:27124/commands/hot-reload:scan-for-changes/
# 3. Console: run reload script
```
```

### 3. Technology-Specific Addition (`/Users/guillaume/Dev/CLAUDE.md`)

#### Location: Add new section after "TypeScript Migration Patterns"
```markdown
### Obsidian Plugin Development

**Environment Setup**:
- Install Hot Reload plugin but expect manual triggering
- Enable Developer Console for debugging
- Set up logging with `--enable-logging --v=1`

**Common Pitfalls & Solutions**:
| Issue | Solution |
|-------|----------|
| Hot reload not working | Check for cached backups, clear Obsidian cache |
| Console logs missing | Only runtime logs appear, use Developer Console |
| Routes not matching | Check Express route order, specific before wildcards |
| Validation blocking | Handle special cases before validation middleware |

**Best Practices**:
- Create shell scripts for all test scenarios
- Document reload methods in project README
- Use FileManager API for all file operations
- Test with self-signed certificates (`curl -k`)
```

## Rationale for Each Addition

### Global CLAUDE.md
- **Shell script pattern**: Universal solution to permission prompts across all projects
- **Electron development section**: Common pattern for many desktop applications
- **Hot reload troubleshooting**: Applies to various development environments

### Project-Level CLAUDE.md  
- **Obsidian-specific cache issues**: Critical learning that saves hours of debugging
- **File operations guidance**: Prevents broken links and indexing issues
- **Testing workflow**: Proven approach for this specific project

### Technology Guidelines
- **Obsidian section**: Consolidates all plugin development learnings
- **Pitfalls table**: Quick reference for common issues
- **Best practices**: Actionable guidance from project experience

## Implementation Priority

1. **HIGH**: Add shell script pattern to global CLAUDE.md (immediate productivity boost)
2. **HIGH**: Add Obsidian cache warning to project CLAUDE.md (critical debugging info)
3. **MEDIUM**: Add Electron logging section (useful for future projects)
4. **LOW**: Add comprehensive Obsidian development section (niche but valuable)

## Next Steps

After reviewing this proposal:
1. Manually apply desired changes to respective CLAUDE.md files
2. Run `~/dotfiles/claude-optimize-hierarchy.sh` to propagate insights
3. Consider creating a template `scripts/` directory for new projects