module.exports = {
  apps: [{
    name: "chatscribe-api",
    script: "./artifacts/api-server/dist/index.mjs",
    env: {
      NODE_ENV: "production",
      PORT: "3000",
    },
    restart_delay: 3000,
    max_restarts: 10,
  }],
};
