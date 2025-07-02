#!/usr/bin/env python3
"""
Local Whisper Transcription Script
Transcribes audio files using the free, local OpenAI Whisper installation
"""

import sys
import json
import os
import tempfile
import whisper
from pathlib import Path

def transcribe_audio(audio_path, model="tiny", language=None):
    """
    Transcribe audio file using local Whisper
    
    Args:
        audio_path (str): Path to the audio file
        model (str): Whisper model size (tiny, base, small, medium, large)
        language (str): Language code (fr, en, es, etc.) or None for auto-detect
    
    Returns:
        dict: Transcription result with text and metadata
    """
    try:
        # Check if audio file exists
        if not os.path.exists(audio_path):
            return {
                "success": False,
                "error": f"Audio file not found: {audio_path}"
            }
        
        # Load Whisper model
        model_instance = whisper.load_model(model)
        
        # Transcribe with language hint if provided
        options = {}
        if language:
            options["language"] = language
        
        result = model_instance.transcribe(audio_path, **options)
        
        # Extract segments for detailed timing (optional)
        segments = []
        if "segments" in result:
            for segment in result["segments"]:
                segments.append({
                    "start": segment.get("start", 0),
                    "end": segment.get("end", 0),
                    "text": segment.get("text", "").strip()
                })
        
        return {
            "success": True,
            "text": result["text"].strip(),
            "language": result.get("language", "unknown"),
            "segments": segments,
            "model_used": model
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Transcription failed: {str(e)}"
        }

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python whisper_transcribe.py <audio_file> [model] [language]"
        }))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "tiny"
    language = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Transcribe the audio
    result = transcribe_audio(audio_path, model, language)
    
    # Output JSON result
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)

if __name__ == "__main__":
    main() 