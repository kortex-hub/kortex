#!/usr/bin/env bash
# Script used to launch a flow within a launch agent
# it adds BEGIN/END markers to the output and the execution time
# it also captures the exit code of the flow and returns it
# Usage: flow-executor.sh <storage-dir> <flow-id> <command...>
set -euo pipefail

storage_dir=$1
shift
scheduler_id=$1
shift


# Parse metadata arguments
metadata_json=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --metadata)
      # Extract key=value from next argument
      if [[ $# -lt 2 ]]; then
        echo "ERROR: --metadata requires a key=value argument" >&2
        exit 1
      fi
      shift
      metadata_entry="$1"
      # Split on first = to get key and value
      if [[ "$metadata_entry" =~ ^([^=]+)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        # Escape value for JSON (basic escaping for quotes and backslashes)
        value_escaped="${value//\\/\\\\}"
        value_escaped="${value_escaped//\"/\\\"}"
        # Add to metadata JSON
        if [[ -z "$metadata_json" ]]; then
          metadata_json="\"$key\":\"$value_escaped\""
        else
          metadata_json="$metadata_json,\"$key\":\"$value_escaped\""
        fi
      else
        echo "ERROR: Invalid metadata format: $metadata_entry (expected key=value)" >&2
        exit 1
      fi
      shift
      ;;
    *)
      # End of metadata arguments, remaining are the command
      break
      ;;
  esac
done

# Check if storage directory exists
if [ ! -d "$storage_dir" ]; then
  echo "ERROR: Storage directory does not exist: $storage_dir" >&2
  echo "Kortex may not be installed or has been removed." >&2
  exit 1
fi

# Create log directory if it doesn't exist
log_dir="$storage_dir/$scheduler_id"
mkdir -p "$log_dir"

start_time=$(date +%s)
timestamp=$(date +%Y%m%d-%H%M%S)
log_file="$log_dir/execution-${timestamp}.log"

echo "<<<KORTEX_SCHEDULE_TASK_BEGIN>>>" > "$log_file"
begin_json="{\"id\":\"$scheduler_id\",\"timestamp\":$start_time,\"metadata\":{$metadata_json}}"

echo "$begin_json" >> "$log_file"
echo "<<<KORTEX_SCHEDULE_TASK_BEGIN_DATA>>>" >> "$log_file"

# Disable exit-on-error temporarily to capture the exit code
set +e
"$@" >>"$log_file" 2>&1
exit_code=${PIPESTATUS[0]}
set -e

end_time=$(date +%s)
duration=$((end_time - start_time))
echo "<<<KORTEX_SCHEDULE_TASK_END_DATA>>>" >> "$log_file"
echo "{\"id\":\"$scheduler_id\",\"timestamp\":$end_time,\"duration\":$duration,\"exitCode\":$exit_code}" >> "$log_file"
echo "<<<KORTEX_SCHEDULE_TASK_END>>>" >> "$log_file"
exit $exit_code
