#!/bin/bash

# Obsidian launcher script with logging support

OBSIDIAN_APP="/Applications/Obsidian.app/Contents/MacOS/Obsidian"
LOG_DIR="$HOME/Library/Logs/Obsidian"
LOG_FILE="$LOG_DIR/obsidian-$(date +%Y%m%d-%H%M%S).log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to kill existing Obsidian processes
kill_obsidian() {
    echo "Killing existing Obsidian processes..."
    killall Obsidian 2>/dev/null || true
    sleep 2
}

# Function to start Obsidian with logging
start_obsidian() {
    echo "Starting Obsidian with logging..."
    echo "Log file: $LOG_FILE"
    
    # Set environment variables for logging
    export ELECTRON_ENABLE_LOGGING=file
    export ELECTRON_LOG_FILE="$LOG_FILE"
    
    # Launch Obsidian with additional debug flags
    "$OBSIDIAN_APP" \
        --enable-logging \
        --v=1 \
        --log-level=0 \
        > "$LOG_DIR/obsidian-stdout.log" 2>&1 &
    
    echo "Obsidian started with PID: $!"
    echo "Waiting for REST API to be ready..."
    
    # Wait for REST API to be available
    for i in {1..30}; do
        if curl -k -s https://127.0.0.1:27124/ > /dev/null 2>&1; then
            echo "REST API is ready!"
            break
        fi
        sleep 1
    done
}

# Function to restart Obsidian
restart_obsidian() {
    kill_obsidian
    start_obsidian
}

# Function to tail logs
tail_logs() {
    echo "Tailing log file: $LOG_FILE"
    tail -f "$LOG_FILE"
}

# Main script logic
case "${1:-start}" in
    start)
        start_obsidian
        ;;
    restart)
        restart_obsidian
        ;;
    stop)
        kill_obsidian
        ;;
    logs)
        tail_logs
        ;;
    *)
        echo "Usage: $0 {start|restart|stop|logs}"
        exit 1
        ;;
esac