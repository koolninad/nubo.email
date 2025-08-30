#!/bin/bash

# Load environment variables
source /var/www/nubo/nubo-backend/.env

# Export OneSignal API key
export ONESIGNAL_REST_API_KEY=$ONESIGNAL_REST_API_KEY

# Start PM2 with environment variables
pm2 delete nubo-backend 2>/dev/null
pm2 start /var/www/nubo/nubo-backend/ecosystem.config.js

echo "Backend started with OneSignal API key configured"