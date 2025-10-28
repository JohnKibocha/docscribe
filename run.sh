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
        read -p "Kill existing process? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill_port $DEV_PORT
        else
            print_error "Cannot start dev server on occupied port"
            exit 1
        fi
    fi
    
    print_info "Starting Vite dev server on port $DEV_PORT..."
    pnpm run dev
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
        kill_port $PREVIEW_PORT
    fi
    
    print_info "Starting preview server on port $PREVIEW_PORT..."
    pnpm run preview
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
    install     Install all project dependencies
    dev         Start development server (port $DEV_PORT)
    build       Build for production
    preview     Preview production build (port $PREVIEW_PORT)
    stop        Stop all running servers
    clean       Clean ports, build artifacts, and node_modules
    deploy      Deploy to Vercel (production)
    lint        Run code quality checks (ESLint, emoji check, em dash check)
    help        Show this help message

EXAMPLES:
    ./run.sh install        # First-time setup
    ./run.sh dev            # Start development
    ./run.sh build          # Build for production
    ./run.sh stop           # Stop all servers
    ./run.sh clean          # Full cleanup
    ./run.sh deploy         # Deploy to Vercel

TROUBLESHOOTING:
    Port already in use:    ./run.sh stop
    Dependency issues:      ./run.sh clean && ./run.sh install
    Build errors:           Check console output and fix TypeScript errors

For more information, see docs/01_project_setup.md
EOF
}

# Main command dispatcher
main() {
    case "${1:-help}" in
        install)
            install_dependencies
            ;;
        dev)
            start_dev
            ;;
        build)
            build_project
            ;;
        preview)
            preview_build
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
