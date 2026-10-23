import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { createApp } from "./app.js";
import { attachChatWebSocket } from "./ws/chatGateway.js";
import { PORT } from "./config.js";

const app = createApp();
const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });
attachChatWebSocket(wss);

httpServer.on("upgrade", (request, socket, head) => {
  const pathname = request.url
    ? new URL(request.url, "http://localhost").pathname
    : "";
  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
