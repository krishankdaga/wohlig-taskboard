import { io } from "socket.io-client";

const socket = io(
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5001",
  {
    autoConnect: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  }
);

export default socket;
