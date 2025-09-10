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
// // Show history context for this conversation
// ui.showHistoryContext(convId);
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
    historyContext: {
        enabled: true,
        position: "left",
        width: "320px",
        title: "Chat History",
        chunkable: true, // Enable chunk-based organization
        defaultCollapsed: false, // Chunks are expanded by default
        chunkSize: 2, // Group 2 messages per chunk
        style: {
            backgroundColor: "#f8f9fa",
            borderColor: "#e9ecef",
            accentColor: "#007bff",
        },
        collapsible: true,
        limit: 20,
        autoUpdate: true,
    },
});

await ui.connect();

const convId = await ui.createConversation();

// Show the history context when conversation starts
ui.showHistoryContext(convId);

// Main trigger for sending messages
const trigger = document.getElementById("trigger");
trigger?.addEventListener("click", async () => {
    await ui.sendMessage(convId, "Call to get some fancy data");
});

// ========================
// Additional UI Controls for History Management
// ========================

// Toggle history visibility
const toggleHistoryBtn = document.getElementById("toggle-history");
toggleHistoryBtn?.addEventListener("click", () => {
    ui.toggleHistoryContext(convId);
});

// Manual history refresh (useful when autoUpdate is disabled)
const refreshHistoryBtn = document.getElementById("refresh-history");
refreshHistoryBtn?.addEventListener("click", () => {
    ui.updateHistoryContext(convId);
});

// Hide history completely
const hideHistoryBtn = document.getElementById("hide-history");
hideHistoryBtn?.addEventListener("click", () => {
    ui.hideHistoryContext();
});

// Example: Create multiple conversations with history switching
const newChatBtn = document.getElementById("new-chat");
const conversations = new Map<string, string>();
let activeConvId = convId;

conversations.set("main", convId);

newChatBtn?.addEventListener("click", async () => {
    const newConvId = await ui.createConversation();
    const chatName = `chat-${conversations.size}`;
    conversations.set(chatName, newConvId);

    // Switch to new conversation
    activeConvId = newConvId;
    ui.showHistoryContext(newConvId);

    console.log(`Created new conversation: ${chatName} (${newConvId})`);
});

// Example: Switch between conversations
const switchChatSelect = document.getElementById(
    "chat-selector",
) as HTMLSelectElement;
if (switchChatSelect) {
    // Populate selector with conversations
    conversations.forEach((id, name) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = name;
        switchChatSelect.appendChild(option);
    });

    switchChatSelect.addEventListener("change", (e) => {
        const selectedConvId = (e.target as HTMLSelectElement).value;
        if (selectedConvId && conversations.has(selectedConvId)) {
            activeConvId = selectedConvId;
            ui.showHistoryContext(selectedConvId);
            console.log(`Switched to conversation: ${selectedConvId}`);
        }
    });
}

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
// Utility Functions for History Management
// ========================

// Function to get conversation summary for display
async function getConversationSummary(convId: string) {
    const messages = await ui.getRecentMessages(convId, 3);
    const content = ui.extractMessageContent(messages);
    return content
        .slice(0, 2)
        .map((msg) =>
            typeof msg === "string"
                ? msg.substring(0, 50) + "..."
                : "Complex message",
        )
        .join(" | ");
}

// Function to export conversation history
async function exportConversation(convId: string) {
    const history = await ui.getConversationHistory(convId);
    const exportData = {
        conversationId: convId,
        exportedAt: new Date().toISOString(),
        messages: history.map((env) => ({
            timestamp: env.timestamp,
            role: env.payload?.role,
            content: env.payload?.content,
            turnId: env.turnId,
        })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${convId}-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
}

// Export conversation button
const exportBtn = document.getElementById("export-conversation");
exportBtn?.addEventListener("click", () => {
    exportConversation(activeConvId);
});

// ========================
// Keyboard Shortcuts for History
// ========================
document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + H: Toggle history
    if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        ui.toggleHistoryContext(activeConvId);
    }

    // Ctrl/Cmd + R: Refresh history
    if ((e.ctrlKey || e.metaKey) && e.key === "r" && e.shiftKey) {
        e.preventDefault();
        ui.updateHistoryContext(activeConvId);
    }

    // Escape: Hide history
    if (e.key === "Escape") {
        ui.hideHistoryContext();
    }
});

// ========================
// Responsive History Management
// ========================
function handleResize() {
    const width = window.innerWidth;

    // Auto-hide history on mobile
    if (width < 768) {
        ui.hideHistoryContext();
    } else if (width > 1024) {
        // Auto-show history on desktop
        ui.showHistoryContext(activeConvId);
    }
}

window.addEventListener("resize", handleResize);
handleResize(); // Initial check

// ========================
// Advanced Usage: Custom History Filtering
// ========================

// Function to show only user messages in history
async function showUserMessagesOnly(convId: string) {
    const allMessages = await ui.getConversationHistory(convId);
    const userMessages = allMessages.filter(
        (env) => env.payload?.role === "user",
    );

    console.log("User messages:", ui.extractMessageContent(userMessages));
}

// Function to get conversation context for new messages
async function getContextForNewMessage(convId: string) {
    const lastUserContext = await ui.getLastUserContext(convId);
    const recentMessages = await ui.getRecentMessages(convId, 5);

    return {
        lastUserMessage: lastUserContext,
        recentContext: ui.extractMessageContent(recentMessages),
    };
}

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
    ui.hideHistoryContext(); // Clean up history UI
    ui.disconnect();
});

// Handle visibility change (tab switching)
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        console.log("📱 Tab hidden - pausing updates");
        // You might want to pause real-time updates
    } else {
        console.log("👀 Tab visible - resuming updates");
        ui.updateHistoryContext(activeConvId);
    }
});

console.log("🚀 GenerativeUI with History Context initialized!");
console.log("📋 Available conversations:", Array.from(conversations.keys()));
console.log("⌨️  Keyboard shortcuts:");
console.log("   Ctrl+H: Toggle history");
console.log("   Ctrl+Shift+R: Refresh history");
console.log("   Escape: Hide history");
