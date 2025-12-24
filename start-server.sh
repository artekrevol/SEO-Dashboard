#!/bin/bash
set -e

# Set internal port for Node.js (Caddy will proxy to this)
export INTERNAL_PORT=${INTERNAL_PORT:-3000}

echo "Starting Node.js server on internal port $INTERNAL_PORT..."
# Start Node.js server in background
npm run start &
NODE_PID=$!

# Wait for server to be ready on internal port
echo "Waiting for Node.js server to be ready..."
for i in {1..60}; do
  if curl -f http://localhost:$INTERNAL_PORT/health > /dev/null 2>&1; then
    echo "✓ Node.js server is ready on port $INTERNAL_PORT"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "✗ Node.js server failed to start within 60 seconds"
    kill $NODE_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# If Caddy is being used, start it (otherwise just keep Node.js running)
if command -v caddy &> /dev/null && [ -f "/assets/Caddyfile" ]; then
  echo "Starting Caddy reverse proxy on port ${PORT}..."
  exec caddy run --config /assets/Caddyfile --adapter caddyfile
else
  echo "Caddy not detected, running Node.js server directly on port ${PORT}"
  wait $NODE_PID
fi

