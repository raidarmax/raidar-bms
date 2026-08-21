module.exports = {
  apps: [
    {
      name: 'raidar-tracker',
      script: './node_modules/.bin/tsx',
      args: '--env-file=.env server/index.ts',
      cwd: __dirname,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,
      kill_timeout: 15000,
      wait_ready: false,
      gracefulShutdown: true,
      env: {
        NODE_ENV: 'production',
        TCP_PORT: '8443',
        API_PORT: '3000',
      },
    },
  ],
};
