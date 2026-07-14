#!/bin/sh

# 1. Link node_modules if not present
if [ ! -e /workspace/node_modules ] && [ ! -L /workspace/node_modules ]; then
  echo "Linking /workspace/node_modules to /app/node_modules for instant boot..."
  ln -s /app/node_modules /workspace/node_modules
fi

# 2. Start Vite dev server
echo "Starting Vite dev server..."
npm run dev &
VITE_PID=$!

# 3. Wait for Vite process
wait $VITE_PID
