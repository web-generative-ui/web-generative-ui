import './transition.css';
import GenerativeUI from './index';

// =========================
// SSE Usage Example
// =========================
const ui = await GenerativeUI.init({
    container: '#container',
    transport: {
        type: 'sse',
        streamURL: 'http://localhost:3000/api/llm-stream',
        sendURL: 'http://localhost:3000/api/llm-message',
    },
})

const convId = await ui.createConversation();
const trigger = document.getElementById('trigger');
trigger?.addEventListener('click', async () => {
    await ui.sendMessage(convId, 'Hello there!');
});

// =========================
// WebSocket Usage Example
// =========================
// const ui = await GenerativeUI.init({
//     container: '#container',
//     transport: {
//         type: 'websocket',
//         url: 'ws://localhost:3000/ws',
//     },
// });
//
// await ui.connect();
//
// const convId = await ui.createConversation();
// const trigger = document.getElementById('trigger');
// trigger?.addEventListener('click', async () => {
//     await ui.sendMessage(convId, 'Call to get some fancy data');
// });
//
// // optional: register higher-level event handlers via the public API
// ui.onMessage((env) => console.log('[ui:onMessage]', env));
// ui.onPatch((patch) => console.log('[ui:onPatch]', patch));
// ui.onControl((c) => console.log('[ui:onControl]', c));
//
// // graceful shutdown
// window.addEventListener('beforeunload', () => {
//     ui.disconnect();
// });
