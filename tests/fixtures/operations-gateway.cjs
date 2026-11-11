// Isolated-test router only. Uses fixed internal destinations, no external proxying.
const http = require('node:http');
const {spawn} = require('node:child_process');
const routes = [
  ['/auth/v1', 'auth', 9999],
  ['/rest/v1', 'rest', 3000],
  ['/storage/v1', 'storage', 5000],
];
const server = http.createServer((req, res) => {
  const route = routes.find(([prefix]) => req.url === prefix || req.url.startsWith(prefix+'/') || req.url.startsWith(prefix+'?'));
  if (!route) {res.writeHead(404); res.end(); return;}
  const [prefix,hostname,port] = route;
  const upstream = http.request({hostname,port,path:req.url.slice(prefix.length)||'/',method:req.method,
    headers:{...req.headers,host:hostname+':'+port}}, r => {res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  upstream.on('error',()=>{if (!res.headersSent) res.writeHead(502);res.end();});
  req.pipe(upstream);
});
server.listen(8080,'127.0.0.1',()=>{
  const app = spawn(process.execPath,['server.js'],{cwd:'/app',stdio:'inherit'});
  app.on('exit',code=>{server.close();process.exit(code || 1);});
  process.on('SIGTERM',()=>{app.kill('SIGTERM');server.close();});
});
