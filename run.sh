#!/bin/bash

#
# @fileoverview Comprehensive automation script for DocScribe project management.
# 
# This script provides a complete CLI interface for dependency installation, building,
# development server management, port cleanup, and production deployment. It handles
# common development operations with proper error handling and user feedback.
#
# Usage: ./run.sh [command]
# Commands: install, dev, build, preview, stop, clean, deploy, help
#
# @see action-plan.md Phase 0 for project setup requirements
#

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="DocScribe"
DEV_PORT=5173
PREVIEW_PORT=4173

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Check if pnpm is installed
check_pnpm() {
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed. Installing now..."
        npm install -g pnpm
        print_success "pnpm installed successfully"
    fi
}

# Install all dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    check_pnpm
    
    print_info "Installing base dependencies..."
    pnpm install
    
    print_info "Installing Tailwind CSS..."
    pnpm install -D tailwindcss postcss autoprefixer
    
    print_info "Installing core dependencies..."
    pnpm install zustand lucide-react
    
    print_info "Installing export libraries..."
    pnpm install jspdf jspdf-autotable docx papaparse file-saver
    pnpm install -D @types/jspdf @types/papaparse @types/file-saver
    
    print_success "All dependencies installed successfully"
}

# Start development server
start_dev() {
    print_header "Starting Development Server"
    
    # Check if port is already in use
    if lsof -Pi :$DEV_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $DEV_PORT is already in use"
        print_info "Killing existing process..."
        kill_port $DEV_PORT
        sleep 1
    fi
    
    print_info "Starting Vite dev server on port $DEV_PORT..."
    print_info "Running in background - use './run.sh stop' to stop server"
    print_info "Logs: tail -f dev.log"
    
    nohup pnpm run dev > dev.log 2>&1 &
    local pid=$!
    echo $pid > dev.pid
    
    # Wait a moment and check if process started successfully
    sleep 2
    if ps -p $pid > /dev/null; then
        print_success "Development server started (PID: $pid)"
        print_success "Access at: http://localhost:$DEV_PORT"
    else
        print_error "Failed to start dev server. Check dev.log for errors"
        exit 1
    fi
}

# Build for production
build_project() {
    print_header "Building for Production"
    
    print_info "Running TypeScript compiler..."
    pnpm run build
    
    print_success "Build completed successfully"
    print_info "Build output is in ./dist directory"
}

# Preview production build
preview_build() {
    print_header "Previewing Production Build"
    
    if [ ! -d "dist" ]; then
        print_error "No build found. Run './run.sh build' first"
        exit 1
    fi
    
    # Check if port is already in use
    if lsof -Pi :$PREVIEW_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $PREVIEW_PORT is already in use"
        print_info "Killing existing process..."
        kill_port $PREVIEW_PORT
        sleep 1
    fi
    
    print_info "Starting preview server on port $PREVIEW_PORT..."
    print_info "Running in background - use './run.sh stop' to stop server"
    print_info "Logs: tail -f preview.log"
    
    nohup pnpm run preview > preview.log 2>&1 &
    local pid=$!
    echo $pid > preview.pid
    
    # Wait a moment and check if process started successfully
    sleep 2
    if ps -p $pid > /dev/null; then
        print_success "Preview server started (PID: $pid)"
        print_success "Access at: http://localhost:$PREVIEW_PORT"
    else
        print_error "Failed to start preview server. Check preview.log for errors"
        exit 1
    fi
}

# Kill process on specific port
kill_port() {
    local port=$1
    print_info "Killing process on port $port..."
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        lsof -ti:$port | xargs kill -9
        print_success "Process on port $port terminated"
    else
        print_warning "No process found on port $port"
    fi
}

# Stop all development servers
stop_servers() {
    print_header "Stopping All Servers"
    
    # Stop dev server by PID
    if [ -f "dev.pid" ]; then
        local dev_pid=$(cat dev.pid)
        if ps -p $dev_pid > /dev/null; then
            print_info "Stopping dev server (PID: $dev_pid)..."
            kill $dev_pid
            rm dev.pid
        fi
    fi
    
    # Stop preview server by PID
    if [ -f "preview.pid" ]; then
        local preview_pid=$(cat preview.pid)
        if ps -p $preview_pid > /dev/null; then
            print_info "Stopping preview server (PID: $preview_pid)..."
            kill $preview_pid
            rm preview.pid
        fi
    fi
    
    # Fallback: kill by port
    kill_port $DEV_PORT
    kill_port $PREVIEW_PORT
    
    # Kill any remaining node processes for this project
    pkill -f "vite" || print_info "No Vite processes found"
    
    print_success "All servers stopped"
}

# Clean ports and build artifacts
clean_all() {
    print_header "Cleaning Project"
    
    print_info "Stopping all servers..."
    stop_servers
    
    print_info "Removing build artifacts..."
    rm -rf dist
    
    print_info "Removing log files..."
    rm -f dev.log preview.log
    
    print_info "Removing PID files..."
    rm -f dev.pid preview.pid
    
    print_info "Removing node_modules..."
    rm -rf node_modules
    
    print_info "Removing lock file..."
    rm -f pnpm-lock.yaml
    
    print_success "Project cleaned successfully"
    print_warning "Run './run.sh install' to reinstall dependencies"
}

# Deploy to Vercel
deploy_vercel() {
    print_header "Deploying to Vercel"
    
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI not installed"
        print_info "Install with: pnpm install -g vercel"
        exit 1
    fi
    
    print_info "Building project..."
    build_project
    
    print_info "Deploying to Vercel..."
    vercel --prod
    
    print_success "Deployment complete"
}

# Lint and format check
lint_check() {
    print_header "Running Code Quality Checks"
    
    print_info "Running ESLint..."
    pnpm run lint
    
    print_info "Checking for emojis in codebase..."
    if grep -r "[\x{1F300}-\x{1F9FF}]" src/ docs/ README.md 2>/dev/null; then
        print_error "Emojis found in codebase. Remove them."
        exit 1
    else
        print_success "No emojis found"
    fi
    
    print_info "Checking for em dashes in documentation..."
    if grep -r "—" docs/ README.md 2>/dev/null; then
        print_error "Em dashes found in documentation. Replace with hyphens."
        exit 1
    else
        print_success "No em dashes found"
    fi
    
    print_success "All quality checks passed"
}

# Show help
show_help() {
    cat << EOF
${PROJECT_NAME} - Project Automation Script

USAGE:
    ./run.sh [command]

COMMANDS:
    install         Install all project dependencies
    start           Start development server (port $DEV_PORT) in background
    start preview   Start preview server (port $PREVIEW_PORT) in background
    build           Build for production
    stop            Stop all running servers
    clean           Clean ports, build artifacts, and node_modules
    deploy          Deploy to Vercel (production)
    lint            Run code quality checks (ESLint, emoji check, em dash check)
    logs            Show development server logs (dev or preview)
    status          Check status of running servers
    help            Show this help message

EXAMPLES:
    ./run.sh install          # First-time setup
    ./run.sh start            # Start dev server (runs in background)
    ./run.sh logs dev         # View dev server logs
    ./run.sh status           # Check what's running
    ./run.sh build            # Build for production
    ./run.sh start preview    # Preview production build
    ./run.sh stop             # Stop all servers
    ./run.sh clean            # Full cleanup
    ./run.sh deploy           # Deploy to Vercel

BACKGROUND MODE:
    Servers run in background by default. Use these commands:
    ./run.sh logs dev         # View dev server logs
    ./run.sh logs preview     # View preview server logs
    ./run.sh stop             # Stop all servers
    tail -f dev.log           # Follow dev logs directly

TROUBLESHOOTING:
    Port already in use:      ./run.sh stop
    Dependency issues:        ./run.sh clean && ./run.sh install
    Build errors:             Check console output and fix TypeScript errors
    Server not starting:      Check dev.log or preview.log

For more information, see docs/01_project_setup.md
EOF
}

# Show logs for dev or preview server
show_logs() {
    local server="${1:-dev}"
    
    if [ "$server" = "dev" ]; then
        if [ -f "dev.log" ]; then
            print_info "Showing dev server logs (Ctrl+C to exit):"
            tail -f dev.log
        else
            print_error "No dev server logs found. Server not started?"
        fi
    elif [ "$server" = "preview" ]; then
        if [ -f "preview.log" ]; then
            print_info "Showing preview server logs (Ctrl+C to exit):"
            tail -f preview.log
        else
            print_error "No preview server logs found. Server not started?"
        fi
    else
        print_error "Unknown server: $server (use 'dev' or 'preview')"
        exit 1
    fi
}

# Show status of running servers
show_status() {
    print_header "Server Status"
    
    local has_running=false
    
    # Check dev server
    if [ -f "dev.pid" ]; then
        local dev_pid=$(cat dev.pid)
        if ps -p $dev_pid > /dev/null; then
            print_success "Dev server: RUNNING (PID: $dev_pid, Port: $DEV_PORT)"
            has_running=true
        else
            print_warning "Dev server: PID file exists but process not running"
            rm dev.pid
        fi
    else
        print_info "Dev server: NOT RUNNING"
    fi
    
    # Check preview server
    if [ -f "preview.pid" ]; then
        local preview_pid=$(cat preview.pid)
        if ps -p $preview_pid > /dev/null; then
            print_success "Preview server: RUNNING (PID: $preview_pid, Port: $PREVIEW_PORT)"
            has_running=true
        else
            print_warning "Preview server: PID file exists but process not running"
            rm preview.pid
        fi
    else
        print_info "Preview server: NOT RUNNING"
    fi
    
    if [ "$has_running" = false ]; then
        echo
        print_info "No servers running. Use './run.sh start' to start dev server"
    fi
}

# Main command dispatcher
main() {
    case "${1:-help}" in
        install)
            install_dependencies
            ;;
        start)
            if [ "$2" = "preview" ]; then
                preview_build
            else
                start_dev
            fi
            ;;
        # Keep legacy aliases for backward compatibility
        dev)
            start_dev
            ;;
        preview)
            preview_build
            ;;
        build)
            build_project
            ;;
        stop)
            stop_servers
            ;;
        clean)
            clean_all
            ;;
        deploy)
            deploy_vercel
            ;;
        lint)
            lint_check
            ;;
        logs)
            show_logs "$2"
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
