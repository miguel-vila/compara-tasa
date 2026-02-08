#!/bin/bash

# Script to continuously run Claude Code to implement remaining savings bank parsers
# Stops when all banks are implemented (Claude outputs '<DONE>')

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ERRORS_FILE="$PROJECT_DIR/ERRORS-SAVINGS.md"
LOG_FILE="$PROJECT_DIR/scripts/implement-savings-banks.log"
BANKS_JSON="$PROJECT_DIR/savings-bank-to-implement.json"

PROMPT='Choose the first non-implemented bank from @savings-bank-to-implement.json and use the /add-savings-bank-account-parser skill to include it. If you have any learnings about including this bank, update the skill. If there are no more banks to implement output "<DONE>" and nothing else. When you successfully implement a bank, output the bank name in this format at the end: <BANK_NAME>BankName</BANK_NAME>'

iteration=0

echo "Starting savings bank implementation loop..."
echo "Project directory: $PROJECT_DIR"
echo "Banks JSON: $BANKS_JSON"
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
        echo "ALL SAVINGS BANKS IMPLEMENTED!"
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
        echo "Savings bank implemented: $bank_name"

        # Update the JSON file to mark the bank as implemented
        current_date=$(date +%Y-%m-%d)

        # Use jq to update the JSON file
        if command -v jq &> /dev/null; then
            jq --arg bank "$bank_name" --arg date "$current_date" '
                map(if .bank_name == $bank then . + {implemented: true, implemented_date: $date} else . end)
            ' "$BANKS_JSON" > "$BANKS_JSON.tmp" && mv "$BANKS_JSON.tmp" "$BANKS_JSON"
            echo "Updated $BANKS_JSON - marked $bank_name as implemented on $current_date"
        else
            echo "WARNING: jq not installed, cannot update $BANKS_JSON"
        fi

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
                git commit -m "Add $bank_name savings parser

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
    echo "Savings bank implementation completed. Starting next iteration..."
    echo ""

    # Small delay to avoid hammering the API
    sleep 2
done
