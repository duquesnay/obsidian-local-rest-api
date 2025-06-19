# SPIKE: Console Proxy for Debug Logging

## Problem
Plugin console.log messages during onload() don't appear in Obsidian logs, even with maximum verbosity.

## Solution Discovered
Use JavaScript Proxy to intercept console methods and write to a custom log file.

## Implementation Plan

### 1. Core Proxy Technique (from Logstravaganza)
```typescript
// Store original console
const originalConsole = window.console;

// Create proxy handler
const handler: ProxyHandler<Console> = {
  get(target, prop) {
    const property = target[prop];
    
    if (typeof property === "function") {
      return (...args: any[]) => {
        // Custom logging logic here
        writeToLogFile(prop.toString(), args);
        
        // Call original method
        return property.apply(target, args);
      };
    }
    
    return property;
  }
};

// Replace console
window.console = new Proxy(originalConsole, handler);
```

### 2. Simple File-Based Logger for REST API Plugin
```typescript
class DebugLogger {
  private logFile: string;
  private originalConsole: Console;
  
  constructor(private app: App) {
    this.logFile = ".obsidian/plugins/obsidian-local-rest-api/debug.log";
    this.originalConsole = window.console;
  }
  
  async enable() {
    // Ensure log file exists
    await this.app.vault.adapter.write(this.logFile, "");
    
    // Proxy console methods
    const self = this;
    const handler: ProxyHandler<Console> = {
      get(target, prop) {
        const property = target[prop];
        
        if (typeof property === "function" && ["log", "error", "warn", "info"].includes(prop.toString())) {
          return (...args: any[]) => {
            // Write to our log file
            const timestamp = new Date().toISOString();
            const level = prop.toString().toUpperCase();
            const message = args.map(arg => 
              typeof arg === "object" ? JSON.stringify(arg) : String(arg)
            ).join(" ");
            
            const logEntry = `[${timestamp}] [${level}] ${message}\n`;
            
            // Append to log file
            self.appendToLog(logEntry);
            
            // Call original method
            return property.apply(target, args);
          };
        }
        
        return property;
      }
    };
    
    window.console = new Proxy(this.originalConsole, handler);
  }
  
  async appendToLog(entry: string) {
    try {
      const current = await this.app.vault.adapter.read(this.logFile);
      await this.app.vault.adapter.write(this.logFile, current + entry);
    } catch (e) {
      // Fallback to original console
      this.originalConsole.error("Failed to write to debug log:", e);
    }
  }
  
  disable() {
    window.console = this.originalConsole;
  }
}
```

### 3. Integration Points
- Enable in plugin constructor or early in onload()
- Disable in onunload()
- Add command to view/clear debug log
- Consider rotation to prevent huge log files

### 4. Benefits
- Captures ALL console output from plugin
- Works during plugin initialization
- Persists across reloads
- Can be read without Developer Console
- Works on mobile too

### 5. Next Steps
1. Implement minimal version in main.ts
2. Test with hot reload
3. Verify debug messages appear
4. Clean up and optimize