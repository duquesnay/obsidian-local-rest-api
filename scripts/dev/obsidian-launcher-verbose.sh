#!/bin/bash

# Enhanced Obsidian launcher with maximum verbosity for debugging
# This captures ALL possible debug output including plugin console logs

OBSIDIAN_APP="/Applications/Obsidian.app/Contents/MacOS/Obsidian"
LOG_DIR="$HOME/Library/Logs/Obsidian"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/obsidian-verbose-$TIMESTAMP.log"
CONSOLE_LOG="$LOG_DIR/obsidian-console-$TIMESTAMP.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to kill existing Obsidian processes
kill_obsidian() {
    echo "Killing existing Obsidian processes..."
    killall Obsidian 2>/dev/null || true
    sleep 2
}

# Function to start Obsidian with MAXIMUM logging
start_obsidian_verbose() {
    echo "Starting Obsidian with MAXIMUM verbosity logging..."
    echo "Main log file: $LOG_FILE"
    echo "Console log file: $CONSOLE_LOG"
    
    # Set ALL logging environment variables
    export ELECTRON_ENABLE_LOGGING=1
    export ELECTRON_LOG_FILE="$LOG_FILE"
    export NODE_ENV=development
    export DEBUG=*  # Enable all debug namespaces
    export ELECTRON_DEBUG_NOTIFICATIONS=1
    export ELECTRON_ENABLE_STACK_DUMPING=1
    export ELECTRON_TRASH=trash-cli
    
    # Chrome/Chromium debugging flags
    export ELECTRON_EXTRA_LAUNCH_ARGS="--enable-logging=stderr --v=3 --vmodule=*/plugins/*=3"
    
    # Launch Obsidian with ALL debug flags
    "$OBSIDIAN_APP" \
        --enable-logging \
        --v=3 \
        --vmodule="*obsidian*=3,*plugin*=3,*rest*=3" \
        --log-level=0 \
        --log-file="$CONSOLE_LOG" \
        --enable-logging=stderr \
        --disable-logging-redirect \
        --enable-chrome-logs \
        --dump-browser-histograms \
        --enable-api-filtering-logging \
        --js-flags="--trace-warnings --trace-deprecation" \
        --enable-blink-features="BlinkGenPropertyTrees" \
        --force-renderer-accessibility \
        > "$LOG_DIR/obsidian-stdout-verbose.log" 2>&1 &
    
    OBSIDIAN_PID=$!
    echo "Obsidian started with PID: $OBSIDIAN_PID"
    
    # Also capture renderer process logs
    sleep 3
    echo "Setting up additional log capture..."
    
    # Monitor for console messages in real-time
    tail -f "$LOG_FILE" | grep -E "CONSOLE\]|REST API|plugin|hot.?reload" > "$LOG_DIR/obsidian-filtered-$TIMESTAMP.log" &
    
    echo "Waiting for REST API to be ready..."
    
    # Wait for REST API with timeout
    local count=0
    while [ $count -lt 30 ]; do
        if curl -k -s https://127.0.0.1:27124/ > /dev/null 2>&1; then
            echo "REST API is ready!"
            break
        fi
        sleep 1
        ((count++))
    done
    
    if [ $count -eq 30 ]; then
        echo "Warning: REST API did not become ready within 30 seconds"
    fi
    
    echo ""
    echo "=== Log file locations ==="
    echo "Main log: $LOG_FILE"
    echo "Console log: $CONSOLE_LOG"
    echo "Stdout log: $LOG_DIR/obsidian-stdout-verbose.log"
    echo "Filtered log: $LOG_DIR/obsidian-filtered-$TIMESTAMP.log"
    echo ""
    echo "To view logs in real-time:"
    echo "  tail -f $LOG_FILE | grep -i 'rest.api'"
}

# Function to show all recent logs
show_all_logs() {
    echo "=== Recent Obsidian logs ==="
    ls -lat "$LOG_DIR"/*.log | head -10
    echo ""
    echo "=== REST API messages from all logs ==="
    grep -h -i "rest.api\|plugin.*loaded\|hot.?reload" "$LOG_DIR"/*.log | tail -30
}

# Function to test logging
test_logging() {
    echo "Testing if logging captures plugin messages..."
    
    # Trigger a hot reload
    echo "Triggering hot reload via REST API..."
    curl -k -X POST https://127.0.0.1:27124/commands/hot-reload:scan-for-changes/ 2>/dev/null
    
    sleep 2
    
    echo ""
    echo "=== Latest plugin messages ==="
    grep -h "REST API" "$LOG_DIR"/*.log | tail -10
}

# Main script logic
case "${1:-start}" in
    start)
        start_obsidian_verbose
        ;;
    restart)
        kill_obsidian
        start_obsidian_verbose
        ;;
    stop)
        kill_obsidian
        ;;
    logs)
        show_all_logs
        ;;
    test)
        test_logging
        ;;
    *)
        echo "Usage: $0 {start|restart|stop|logs|test}"
        echo ""
        echo "  start   - Start Obsidian with maximum verbosity logging"
        echo "  restart - Kill and restart Obsidian"
        echo "  stop    - Stop Obsidian"
        echo "  logs    - Show recent log entries"
        echo "  test    - Test if logging is capturing plugin messages"
        exit 1
        ;;
esac