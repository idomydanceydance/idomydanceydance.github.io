#!/bin/bash

# Define the source directory (your repository) and output file
SOURCE_DIR="/home/arnold/playground/idomydanceydance.github.io"
OUTPUT_FILE="combined_output.txt"

# Clear the output file if it exists or create a new one
> "$OUTPUT_FILE"

# Find all files in the source directory and process them
find "$SOURCE_DIR" -type f | while read -r file; do
    # Get the relative path from the source directory
    rel_path=$(echo "$file" | sed "s|$SOURCE_DIR/||")
    
    # Print the file path as a header
    echo "=== PATH: $rel_path ===" >> "$OUTPUT_FILE"
    
    # Append the file contents
    cat "$file" >> "$OUTPUT_FILE"
    
    # Add a separator between files
    echo "" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
done

echo "Files have been combined into $OUTPUT_FILE"
