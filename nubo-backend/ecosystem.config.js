const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
const envConfig = dotenv.config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [{
    name: 'nubo-backend',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      ...envConfig.parsed, // Include all environment variables from .env first
      NODE_ENV: 'production',
      PORT: 5000 // Override PORT to 5000 for consistency with nginx
    },
    error_file: '/var/log/pm2/backend-error.log',
    out_file: '/var/log/pm2/backend-out.log',
    merge_logs: true,
    time: true
  }]
};