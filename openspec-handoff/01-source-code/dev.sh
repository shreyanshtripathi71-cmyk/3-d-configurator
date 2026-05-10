#!/bin/bash
export PATH="/Users/rafi/.local/node/bin:$PATH"
cd "/Users/rafi/Desktop/Newkore Website"
exec /Users/rafi/.local/node/bin/node node_modules/.bin/next dev --port 3000
