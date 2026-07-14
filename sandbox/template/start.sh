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

# 3. In the background, copy node_modules to make it writable
if [ -L /workspace/node_modules ]; then
  (
    echo "Starting background copy of node_modules to shared volume..."
    cp -r /app/node_modules /workspace/node_modules_tmp
    
    # Atomically replace the symlink with the real directory
    rm /workspace/node_modules
    mv /workspace/node_modules_tmp /workspace/node_modules
    echo "Background copy of node_modules completed successfully."
  ) &
fi

# 4. Wait for Vite process
wait $VITE_PID
