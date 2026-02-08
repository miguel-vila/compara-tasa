#!/bin/bash

# Script to continuously run Claude Code to implement remaining bank parsers
# Stops when all banks are implemented (Claude outputs '<DONE>')

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ERRORS_FILE="$PROJECT_DIR/ERRORS.md"
LOG_FILE="$PROJECT_DIR/scripts/implement-banks.log"

PROMPT='Choose one of the remaining banks in @PROGRESS.md (in order of priority), and use the /add-bank-parser skill to include it. If you have any learning about including this bank, update the skill. If there are no more banks to implement output "<DONE>" and nothing else. When you successfully implement a bank, output the bank name in this format at the end: <BANK_NAME>BankName</BANK_NAME>'

iteration=0

echo "Starting bank implementation loop..."
echo "Project directory: $PROJECT_DIR"
echo "Logging to: $LOG_FILE"
echo ""

while true; do
    iteration=$((iteration + 1))
    echo "=========================================="
    echo "Iteration $iteration - $(date)"
    echo "=========================================="

    # Run Claude Code and capture output
    # Using --print to get just the output, -p for non-interactive mode
    output=$(cd "$PROJECT_DIR" && claude -p "$PROMPT" --allowedTools "Bash,Edit,Glob,Grep,Read,Write,Task,Skill,WebFetch,TodoWrite" 2>&1) || {
        exit_code=$?
        echo "Claude Code exited with code $exit_code"

        # Log the error
        {
            echo ""
            echo "## Error at iteration $iteration - $(date)"
            echo ""
            echo "Exit code: $exit_code"
            echo ""
            echo "Output:"
            echo '```'
            echo "$output"
            echo '```'
        } >> "$ERRORS_FILE"

        echo "Error logged to $ERRORS_FILE"
        echo "Continuing to next iteration..."
        continue
    }

    # Log the output
    {
        echo ""
        echo "=========================================="
        echo "Iteration $iteration - $(date)"
        echo "=========================================="
        echo "$output"
    } >> "$LOG_FILE"

    # Check if output contains <DONE>
    if echo "$output" | grep -q '<DONE>'; then
        echo ""
        echo "=========================================="
        echo "ALL BANKS IMPLEMENTED!"
        echo "Total iterations: $iteration"
        echo "=========================================="
        exit 0
    fi

    # Check for major errors in output
    if echo "$output" | grep -qi "error\|failed\|exception"; then
        {
            echo ""
            echo "## Potential issue at iteration $iteration - $(date)"
            echo ""
            echo "Output contained error-like keywords. Review:"
            echo '```'
            echo "$output" | grep -i "error\|failed\|exception" | head -20
            echo '```'
        } >> "$ERRORS_FILE"
    fi

    # Extract bank name from output (using sed for macOS compatibility)
    bank_name=$(echo "$output" | sed -n 's/.*<BANK_NAME>\(.*\)<\/BANK_NAME>.*/\1/p' | head -1)

    if [ -n "$bank_name" ]; then
        echo ""
        echo "Bank implemented: $bank_name"
        echo "Building and running update-rates..."

        # Build the packages
        cd "$PROJECT_DIR"
        if pnpm --filter @compara-tasa/core build && pnpm --filter @compara-tasa/updater build; then
            echo "Build successful"

            # Run update-rates
            if pnpm update-rates; then
                echo "update-rates completed successfully"

                # Stage all changes and commit
                git add -A
                git commit -m "Add $bank_name parser

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
                echo "Committed changes for $bank_name"
            else
                echo "WARNING: update-rates failed"
                {
                    echo ""
                    echo "## update-rates failed at iteration $iteration - $(date)"
                    echo ""
                    echo "Bank: $bank_name"
                } >> "$ERRORS_FILE"
            fi
        else
            echo "WARNING: Build failed"
            {
                echo ""
                echo "## Build failed at iteration $iteration - $(date)"
                echo ""
                echo "Bank: $bank_name"
            } >> "$ERRORS_FILE"
        fi
    else
        echo "WARNING: Could not extract bank name from output"
    fi

    echo ""
    echo "Bank implementation completed. Starting next iteration..."
    echo ""

    # Small delay to avoid hammering the API
    sleep 2
done
