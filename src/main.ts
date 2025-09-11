import "./transition.css";
import GenerativeUI from "./index";

// =========================
// SSE Usage Example with History Context
// =========================
// const ui = await GenerativeUI.init({
//     container: '#container',
//     transport: {
//         type: 'sse',
//         streamURL: 'http://localhost:3000/api/llm-stream',
//         sendURL: 'http://localhost:3000/api/llm-message',
//     },
//     historyContext: {
//         enabled: true,
//         position: 'right',
//         width: '300px',
//         title: 'Conversation History',
//         collapsible: true,
//         limit: 15,
//         autoUpdate: true
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
// WebSocket Usage Example with Enhanced History
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

// ========================
// Enhanced Event Handlers
// ========================

// optional: register higher-level event handlers via the public API
ui.onMessage((env) => {
    console.log("[ui:onMessage]", env);

    // Example: Show notification when new message arrives
    if (env.payload?.role === "assistant") {
        console.log("🤖 Assistant replied:", env.payload.content);
    }
});

ui.onPatch((patch) => {
    console.log("[ui:onPatch]", patch);

    // Example: Handle real-time updates to UI components
    if (patch.type === "component_update") {
        console.log("🔄 Component updated:", patch.componentId);
    }
});

ui.onControl((c) => {
    console.log("[ui:onControl]", c);

    // Example: Handle control messages (like typing indicators)
    if (c.type === "typing_start") {
        console.log("⌨️ Assistant is typing...");
    } else if (c.type === "typing_end") {
        console.log("✅ Assistant finished typing");
    }
});

// ========================
// Cleanup and Error Handling
// ========================

// Enhanced error handling
ui.onMessage((env) => {
    if (env.type === "error") {
        console.error("❌ Error in conversation:", env.payload);
        // You might want to show this in the UI
    }
});

// graceful shutdown with history cleanup
window.addEventListener("beforeunload", () => {
    console.log("🔌 Disconnecting GenerativeUI...");
    ui.disconnect();
});

