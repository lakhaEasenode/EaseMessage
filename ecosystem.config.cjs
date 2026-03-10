module.exports = {
    apps: [
      {
        name: 'easemessage-server',
        script: './index.js',
        cwd: '/home/lakhendra/workspace/EaseMessage/server',
        env: {
          NODE_ENV: 'production',
        },
        instances: 1,          // increase if you need clustering
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',   
      },
    ],
  };
