module.exports = {
  apps: [
    {
      name: 'nubo-backend',
      script: 'dist/index.js',
      cwd: '/var/www/nubo/nubo-backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/pm2/backend-error.log',
      out_file: '/var/log/pm2/backend-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M'
    },
    {
      name: 'nubo-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/nubo/nubo-frontend',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/frontend-error.log',
      out_file: '/var/log/pm2/frontend-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M'
    }
  ]
};
