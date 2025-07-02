#!/bin/bash
# Shell wrapper for Whisper transcription
# Uses the pipx environment where whisper is installed

# Add pipx to PATH
export PATH="/Users/antoine/.local/bin:$PATH"

# Get the audio file path
AUDIO_FILE="$1"
MODEL="${2:-tiny}"
LANGUAGE="${3:-auto}"

# Check if audio file is provided
if [ -z "$AUDIO_FILE" ]; then
    echo '{"success": false, "error": "Usage: ./whisper_transcribe.sh <audio_file> [model] [language]"}'
    exit 1
fi

# Check if audio file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "{\"success\": false, \"error\": \"Audio file not found: $AUDIO_FILE\"}"
    exit 1
fi

# Run whisper and capture output
if [ "$LANGUAGE" = "auto" ]; then
    # Auto-detect language
    RESULT=$(whisper "$AUDIO_FILE" --model "$MODEL" --output_format json --output_dir /tmp 2>/dev/null)
else
    # Use specified language
    RESULT=$(whisper "$AUDIO_FILE" --model "$MODEL" --language "$LANGUAGE" --output_format json --output_dir /tmp 2>/dev/null)
fi

# Get the base filename without extension
BASENAME=$(basename "$AUDIO_FILE" .wav)
JSON_FILE="/tmp/${BASENAME}.json"

# Check if JSON output was created
if [ -f "$JSON_FILE" ]; then
    # Extract the text from the JSON file
    TEXT=$(python3 -c "
import json
import sys
try:
    with open('$JSON_FILE', 'r') as f:
        data = json.load(f)
    result = {
        'success': True,
        'text': data.get('text', '').strip(),
        'language': data.get('language', 'unknown'),
        'model_used': '$MODEL'
    }
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(json.dumps({'success': False, 'error': f'Failed to parse result: {str(e)}'}, ensure_ascii=False))
")
    
    # Clean up temporary JSON file
    rm -f "$JSON_FILE"
    
    echo "$TEXT"
else
    echo '{"success": false, "error": "Whisper transcription failed"}'
    exit 1
fi 