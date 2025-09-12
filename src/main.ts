import "./transition.css";
import GenerativeUI from "./index";

// =========================
// SSE Usage Example
// =========================
// const ui = await GenerativeUI.init({
//     container: '#container',
//     transport: {
//         type: 'sse',
//         streamURL: 'http://localhost:3000/api/llm-stream',
//         sendURL: 'http://localhost:3000/api/llm-message',
//     }
// });
//
// const convId = await ui.createConversation();
//
// const trigger = document.getElementById('trigger');
// trigger?.addEventListener('click', async () => {
//     await ui.sendMessage(convId, 'Hello there!');
//     // History will automatically update due to autoUpdate: true
// });

// ========================
// WebSocket Usage Example
// ========================
const ui = await GenerativeUI.init({
    container: "#container",
    transport: {
        type: "websocket",
        url: "ws://localhost:3000/ws",
    },
});

await ui.connect();

const convId = await ui.createConversation();

// Main trigger for sending messages
const trigger = document.getElementById("trigger");
trigger?.addEventListener("click", async () => {
    await ui.sendMessage(convId, "Call to get some fancy data");
});

const conversations = new Map<string, string>();
conversations.set("main", convId);

window.addEventListener("beforeunload", () => {
    console.log("🔌 Disconnecting GenerativeUI...");
    ui.disconnect();
});

