// PM2 process config — run with: pm2 start ecosystem.config.cjs
// Env vars are loaded from each app's .env file by the app itself.
// Set secrets in /etc/environment or the OS-level env so PM2 inherits them,
// OR inline them under env_production below and keep that file out of git.

module.exports = {
  apps: [
    {
      name: "socio-server",
      cwd: "./server",
      script: "index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
        PORT: 8000,
        // Set all server secrets in the OS environment or a .env file —
        // do NOT commit secret values here.
        // Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
        //           RESEND_API_KEY, ALLOWED_ORIGINS, APP_URL
      },
    },
    {
      name: "socio-client",
      cwd: "./client",
      script: "node_modules/.bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "768M",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        // Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
        //           NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL
      },
    },
  ],
};
