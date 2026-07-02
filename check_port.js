const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const conf = `
server {
    listen 80;
    server_name hanxue-api.611519.xyz;

    location / {
        proxy_pass http://207.57.131.146:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
    }
}
`;
  conn.exec(`echo "${conf}" > /tmp/hanxue-api.conf && cp /tmp/hanxue-api.conf /opt/1panel/apps/openresty/openresty/conf/conf.d/hanxue-api.conf && docker exec 1Panel-openresty-UpCv nginx -s reload`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => console.log('STDOUT: ' + data))
      .stderr.on('data', (data) => console.log('STDERR: ' + data));
  });
}).connect({ host: '207.57.131.146', port: 50520, username: 'root', password: '1kMO4MrEvB00' });
