#!/bin/bash

echo "Starting ingredient backfill..."
echo "Make sure your Next.js dev server is running on port 3000!"
echo ""

npx tsx scripts/backfill-ingredients.ts

