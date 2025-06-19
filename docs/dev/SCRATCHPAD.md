# Scratchpad - Log Filtering Analysis

## Current Logging Configuration in obsidian-launcher.sh

```bash
# Current flags:
--enable-logging
--v=1
--log-level=0
```

## Analysis of Log Filtering

### Current Issues:
1. **Limited verbosity**: `--v=1` is relatively low (scale goes up to 3 or 4)
2. **Electron logging**: Only captures Electron/Chromium logs, not all console outputs
3. **Log level 0**: This is actually the MOST verbose (0=all, higher numbers filter more)
4. **Missing console redirect**: stdout/stderr redirect only captures launcher output, not internal console

### What We're Missing:
- Plugin console.log/debug statements at startup
- Detailed plugin lifecycle events
- File system watcher events
- Hot reload detection details

### Recommended Changes:
1. ✅ Increase verbosity level (--v=3)
2. ✅ Add more Electron/Chromium debug flags
3. ✅ Enable Node.js debugging (DEBUG=*)
4. ✅ Add console API interception (--log-file)
5. ✅ Capture stderr separately
6. ✅ Add vmodule for targeted verbosity
7. ✅ Real-time log filtering for REST API messages

## Testing Commands

```bash
# Current log search
grep -i "rest.api" ~/Library/Logs/Obsidian/obsidian-*.log

# What we should see but don't:
# - "[REST API] PLUGIN LOADED WITH UPDATED CODE"
# - "[REST API] Hot reload test at:"
# - File watcher registration logs
```

## Enhanced Logging Flags Analysis

### Original obsidian-launcher.sh issues:
1. **--v=1**: Too low verbosity (should be 3 for maximum)
2. **Missing --vmodule**: Can't target specific module verbosity
3. **No stderr capture**: Plugin console.error might go to stderr
4. **No DEBUG environment**: Node.js debug output disabled
5. **No console log redirection**: Missing --log-file flag

### New Enhanced Flags in obsidian-launcher-verbose.sh:
```bash
--v=3                              # Maximum general verbosity
--vmodule="*plugin*=3,*rest*=3"   # Target plugin logs specifically
--log-file="$CONSOLE_LOG"          # Separate console output file
--enable-logging=stderr            # Capture stderr
--disable-logging-redirect         # Don't redirect, keep raw output
--js-flags="--trace-warnings"     # JavaScript engine warnings
```

### Environment Variables Added:
- `DEBUG=*` - Enable all Node.js debug namespaces
- `NODE_ENV=development` - Development mode for more verbose output
- `ELECTRON_DEBUG_NOTIFICATIONS=1` - Debug notifications
- `ELECTRON_ENABLE_STACK_DUMPING=1` - Stack traces

## Expected Results:
The enhanced script should capture:
1. Plugin initialization console logs
2. Hot reload file watcher events  
3. REST API request details
4. JavaScript errors and warnings
5. Electron renderer process logs
