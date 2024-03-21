const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:8080",
        methods: ["GET", "POST"],
    },
});

app.use(cors());
app.use(express.json());

const port = 4000;

let backendServers = [
    "http://backend-container-1:3001/checkHealth",
    "http://backend-container-2:3001/checkHealth",
    "http://backend-container-3:3001/checkHealth"

];

app.post("/addServer", (req, res) => {
    const { serverUrl } = req.body;
    if (serverUrl && !backendServers.includes(serverUrl)) {
        backendServers.push(serverUrl);
        res.status(200).send({ message: "Servidor añadido al monitoreo" });
    } else {
        res.status(400).send({ message: "URL del servidor inválida o ya está siendo monitoreada" });
    }
});

let clientCount = 0;
let healthCheckInterval;

function startMonitoring() {
    if (!healthCheckInterval) {
        healthCheckInterval = setInterval(async () => {
            const healthCheckResults = [];

            for (const backendUrl of backendServers) {
                const result = await checkBackendHealth(backendUrl);
                healthCheckResults.push(result);
            }

            io.emit("update_health_checks", {
                results: healthCheckResults,
            });
        }, 3000);
    }
}

function stopMonitoring() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }
}

io.on("connection", (socket) => {
    console.log("Cliente conectado");
    clientCount++;
    startMonitoring();

    socket.on("disconnect", () => {
        console.log("Cliente desconectado");
        clientCount--;
        if (clientCount === 0) {
            stopMonitoring();
        }
    });
});

async function checkBackendHealth(backendUrl) {
    try {
        const startTime = Date.now();
        const response = await fetch(backendUrl, { timeout: 3000 });
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (!response.ok) {
            throw new Error(`Response not OK: ${response.status}`);
        }

        return { url: backendUrl, status: "up", responseTime };
    } catch (error) {
        console.error(`Error checking health of ${backendUrl}:`, error.message);
        return { url: backendUrl, status: "down", responseTime: null };
    }
}

io.on("connection", (socket) => {
    console.log("Cliente conectado");
});

server.listen(port, () => {
    console.log(`Servidor de monitoreo escuchando en el puerto ${port}`);
});