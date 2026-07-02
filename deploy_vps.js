const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '207.57.131.146',
  port: 50520,
  username: 'root',
  password: '1kMO4MrEvB00'
};

const deployCommand = `
  cd /opt/MuseSync
  echo "=== FETCHING AND RESETTING GIT ==="
  git fetch --all
  git reset --hard origin/main
  git pull
  echo "=== INSTALLING DEPS ==="
  pnpm install
  echo "=== BUILDING SERVER ==="
  pnpm --filter @musesync/server build
  echo "=== RELOADING PM2 ==="
  pm2 reload musesync-backend
  pm2 save
  echo "=== DEPLOY COMPLETE ==="
`;

console.log('Connecting to VPS...');
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(deployCommand, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.error('STDERR: ' + data);
    });
  });
}).connect(config);
