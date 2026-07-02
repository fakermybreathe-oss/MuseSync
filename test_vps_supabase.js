const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '207.57.131.146',
  port: 50520,
  username: 'root',
  password: '1kMO4MrEvB00'
};

const cmd = 'curl -s -o /dev/null -w "%{http_code}" https://uaypgtiuocytadgbrnue.supabase.co/auth/v1/health';

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', (data) => {
      console.log('HTTP_CODE: ' + data);
    }).stderr.on('data', (data) => {
      console.error('STDERR: ' + data);
    });
  });
}).connect(config);
