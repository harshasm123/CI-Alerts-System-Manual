#!/bin/bash

# Fix TypeScript compilation errors
# Clean cache and rebuild

echo "🧹 Cleaning TypeScript cache..."
cd infrastructure

# Remove compiled files
rm -rf node_modules
rm -rf dist
rm -f *.tsbuildinfo

echo "📦 Reinstalling dependencies..."
npm install

echo "🔨 Rebuilding TypeScript..."
npm run build

echo "✅ Build complete!"
