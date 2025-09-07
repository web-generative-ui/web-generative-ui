import './transition.css';
import GenerativeUI from './index';

GenerativeUI.start({
    container: '#container',
    transport: {
        type: 'sse',
        streamURL: 'http://localhost:3000/api/llm-stream',
        sendURL: 'http://localhost:3000/api/llm-message',
    },
}).then(async ui => {
    const trigger = document.getElementById('trigger');
    trigger?.addEventListener('click', async () => {
        const convId = await ui.createConversation();
        await ui.sendMessage(convId, "Hello there!");
        // From here on, UI auto-updates when responses arrive
    });
});

// (async () => {
//     const ui = await GenerativeUI.start({
//         container: '#container',
//         transport: {
//             type: 'websocket',
//             url: 'ws://localhost:3000/ws',
//         },
//     });
//
//     // explicit connect for transports that require it (WS)
//     await ui.connect();
//
//     // optional: register higher-level event handlers via the public API
//     ui.onMessage((env) => console.log('[ui:onMessage]', env));
//     ui.onPatch((patch) => console.log('[ui:onPatch]', patch));
//     ui.onControl((c) => console.log('[ui:onControl]', c));
//
//     const trigger = document.getElementById('trigger');
//     trigger?.addEventListener('click', async () => {
//         const convId = await ui.createConversation();
//         await ui.sendMessage(convId, 'Hello there!');
//     });
//
//     // graceful shutdown
//     window.addEventListener('beforeunload', () => {
//         ui.disconnect();
//     });
// })();
