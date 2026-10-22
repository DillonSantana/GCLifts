// Local GClifts server: serves the site and the WebSocket on one port, with data kept in memory.
// Run with `npm start`, then open http://localhost:8787. Phones on the same Wi-Fi can use http://<this computer's IP>:8787.
import http from "node:http";
import {readFile} from "node:fs/promises";
import {extname,join,normalize} from "node:path";
import {fileURLToPath} from "node:url";
import {networkInterfaces} from "node:os";
import {WebSocketServer} from "ws";
import {createServer,memoryDb} from "./core.mjs";

const ROOT=fileURLToPath(new URL("..",import.meta.url));
const PORT=+process.env.PORT||8787;
const PUBLIC=new Set(["index.html","config.js","styles/app.css"]);
const TYPES={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};

const sockets=new Map();let next=1;
const app=createServer({db:memoryDb(),send:async(id,msg)=>{const ws=sockets.get(id);if(!ws||ws.readyState!==1)return false;ws.send(JSON.stringify(msg))}});

const server=http.createServer(async(req,res)=>{
  let path=normalize(decodeURIComponent(new URL(req.url,"http://x").pathname)).replace(/^[/\\]+/,"")||"index.html";
  // config.js points the page at a deployed backend; locally the page uses this server, so serve an empty one if it's missing.
  if(!PUBLIC.has(path.replaceAll("\\","/"))){res.writeHead(404).end("Not found");return}
  try{const body=await readFile(join(ROOT,path));res.writeHead(200,{"content-type":TYPES[extname(path)],"cache-control":"no-store"}).end(body)}
  catch{if(path==="config.js"){res.writeHead(200,{"content-type":TYPES[".js"]}).end("");return}res.writeHead(404).end("Not found")}
});

new WebSocketServer({server,path:"/ws",maxPayload:16*1024}).on("connection",async ws=>{
  const id=String(next++);sockets.set(id,ws);await app.connect(id);
  ws.on("message",async data=>{const reply=await app.message(id,String(data));if(ws.readyState===1)ws.send(JSON.stringify(reply))});
  ws.on("close",async()=>{sockets.delete(id);await app.disconnect(id)});
});

server.listen(PORT,()=>{
  const ips=Object.values(networkInterfaces()).flat().filter(i=>i&&i.family==="IPv4"&&!i.internal).map(i=>i.address);
  console.log(`GClifts is running at http://localhost:${PORT}`);
  for(const ip of ips)console.log(`On another device on the same Wi-Fi: http://${ip}:${PORT}`);
  console.log("Data is kept in memory and resets when you stop the server.");
});
