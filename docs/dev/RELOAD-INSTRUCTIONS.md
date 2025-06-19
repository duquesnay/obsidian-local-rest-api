# Plugin Reload Test Instructions

## Current Situation
- The plugin is running from a backup directory (`.obsidian/plugins/obsidian-local-rest-api.backup-20250617-160418`)
- We've added a `/debug/info` endpoint to test code reloading
- The endpoint should return JSON with a `testValue` field

## Test Procedure

1. **Open Obsidian Developer Console** (Cmd+Option+I)

2. **Run the reload script**:
   ```javascript
   // Copy and paste the contents of reload-plugin-api.js
   ```

3. **Verify the plugin loaded from the correct directory**:
   ```bash
   ./test-api.sh status
   # Should show dir: ".obsidian/plugins/obsidian-local-rest-api" (not backup)
   ```

4. **Test the debug endpoint**:
   ```bash
   ./test-api.sh debug
   # Should return JSON with testValue: "ORIGINAL"
   ```

5. **Change the test value**:
   - Edit `src/requestHandler.ts`
   - Change `testValue: "ORIGINAL"` to `testValue: "UPDATED"`
   - Run `npm run build`

6. **Reload and verify**:
   - Run reload script again in Developer Console
   - Check debug endpoint: `./test-api.sh debug`
   - Should now show `testValue: "UPDATED"`

## What This Proves
- If the testValue changes after reload, the plugin IS reloading new code
- If it doesn't change, we have a build/deployment issue
- The requestCounter will reset to 0 on each reload (another indicator)