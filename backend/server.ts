import express from 'express';
import path from 'path';
import cors from 'cors';
import {Request, Response} from 'express';
import {WebSocketServer, WebSocket} from 'ws';
import http from 'http';

const app = express();
const PORT = 3000;

app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

type PatchOperation = 'add' | 'update' | 'remove';

interface Component {
    component: string;
    id?: string;

    [key: string]: any;
}

interface Patch {
    op: PatchOperation;
    path?: string | null;
    targetId?: string;
    value?: Component;
}

// --- WebSocket logic ---
const wss = new WebSocketServer({noServer: true});

const simulateWebSocketResponse = async (ws: WebSocket, convId: string) => {
    const sendPatch = (patch: Patch) => {
        const envelope = {
            type: 'patch',
            convId,
            payload: patch
        };
        ws.send(JSON.stringify(envelope));
    };

    // Add a Box container
    sendPatch({
        op: 'add',
        path: null,
        value: {component: 'box', id: 'main-box'},
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Add a Card inside the Box
    sendPatch({
        op: 'add',
        path: 'main-box',
        value: {component: 'card', id: 'process-card', title: '⚡ Initializing...'},
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Add a Text inside the Card
    sendPatch({
        op: 'add',
        path: 'process-card',
        value: {component: 'text', id: 'status-text', text: 'Setting up environment...'},
    });
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Update the Text
    sendPatch({
        op: 'update',
        targetId: 'status-text',
        value: {component: 'text', id: 'status-text', text: 'Loading resources...'},
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Add a Loading indicator inside the Card
    sendPatch({
        op: 'add',
        path: 'process-card',
        value: {component: 'loading', id: 'loader', variant: 'dots'},
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update the Card title to show success
    sendPatch({
        op: 'update',
        targetId: 'process-card',
        value: {component: 'card', id: 'process-card', title: '✅ Setup Complete'},
    });

    // Remove the old status text
    sendPatch({
        op: 'remove',
        targetId: 'status-text'
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Replace loader with final Text
    sendPatch({
        op: 'update',
        targetId: 'loader',
        value: {component: 'text', id: 'final-text', text: 'System is ready for use.'},
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Divider before results section
    sendPatch({
        op: 'add',
        path: 'main-box',
        value: {component: 'divider', id: 'results-divider', orientation: 'horizontal', label: 'Results Overview'},
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Spacer for layout
    sendPatch({
        op: 'add',
        path: 'main-box',
        value: {component: 'spacer', id: 'spacer-1', size: '2rem'},
    });

    // Add Grid layout
    sendPatch({
        op: 'add',
        path: 'main-box',
        value: {
            component: 'grid',
            id: 'result-grid',
            columns: 2,
            gap: '1rem',
            children: {
                items: [
                    {
                        component: 'image',
                        id: 'success-image',
                        src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ2m5lrUnvYTjtpAQlMry8arqTYivCPiRYfkA&s',
                        alt: 'Setup complete illustration',
                        caption: 'All systems are operational',
                        fit: 'cover'
                    },
                    {
                        component: 'progress',
                        id: 'progress-bar',
                        value: 70,
                        variant: 'linear',
                        label: 'Processing',
                        indeterminate: false,
                    },
                    {
                        component: 'badge',
                        id: 'status-badge',
                        text: 'Stable',
                        variant: 'success',
                        icon: {
                            component: 'icon',
                            name: 'check_circle',
                            variant: 'filled',
                            position: 'left',
                            size: '1em',
                        }
                    },
                    {
                        component: 'button',
                        id: 'continue-btn',
                        label: 'Proceed',
                        action: 'next-step',
                        icon: {
                            component: 'icon',
                            name: 'arrow_forward',
                            variant: 'filled',
                            position: 'right',
                            size: '1.2em'
                        }
                    }
                ]
            }
        },
    });

    // Send final message envelope
    const finalMessage = {
        type: 'message',
        convId,
        turnId: 'srv-final-' + Date.now(),
        payload: {
            role: 'assistant',
            content: {text: 'Here are the results (mock).'}
        }
    };
    ws.send(JSON.stringify(finalMessage));
};

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket client connected:', req.socket.remoteAddress);

    ws.on('message', (data) => {
        try {
            const envelope = JSON.parse(data.toString());
            console.log('WS recv:', envelope);

            const convId = envelope?.convId ?? 'unknown-conv';

            // 1) immediate ACK message envelope (assistant message)
            const ackEnvelope = {
                type: 'message',
                convId,
                turnId: 'srv-ack-' + Date.now(),
                payload: {
                    role: 'assistant',
                    content: {text: `SERVER: Acknowledged: ${String(envelope?.payload?.content?.text ?? '')}`}
                }
            };
            ws.send(JSON.stringify(ackEnvelope));

            // Continue with the full mock data sequence
            simulateWebSocketResponse(ws, convId).catch(err => {
                console.error('Error in simulateWebSocketResponse:', err);
            });

        } catch (err) {
            console.error('Failed to parse WS message', err);
            ws.send(JSON.stringify({type: 'control', convId: 'unknown', payload: {error: 'bad_request'}}));
        }
    });

    ws.on('close', (code, reason) => {
        console.log('WS client disconnected', code, reason?.toString());
    });

    ws.on('error', (err) => {
        console.error('WS error', err);
    });
});

// --- HTTP/SSE logic (now modified to be consistent with WS envelopes) ---
app.get('/api/llm-stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    console.log('Client connected for SSE stream.');

    const sendPatch = (patch: Patch) => {
        const envelope = {
            type: 'patch',
            payload: patch
        };
        const data = `data: ${JSON.stringify(envelope)}\n\n`;
        res.write(data);
    };

    const sendFinalMessage = (convId: string) => {
        const envelope = {
            type: 'message',
            convId,
            turnId: 'srv-final-' + Date.now(),
            payload: {
                role: 'assistant',
                content: {text: 'Here are the results (mock).'}
            }
        };
        const data = `data: ${JSON.stringify(envelope)}\n\n`;
        res.write(data);
    };

    const closeStream = () => {
        res.write('event: close\n\n');
    };

    const simulateResponse = async () => {
        // Use a mock conversation ID
        const convId = 'mock-sse-conv-' + Date.now();

        // Add a Box container
        sendPatch({
            op: 'add',
            path: null,
            value: {component: 'box', id: 'main-box'},
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Add a Card inside the Box
        sendPatch({
            op: 'add',
            path: 'main-box',
            value: {component: 'card', id: 'process-card', title: '⚡ Initializing...'},
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Add a Text inside the Card
        sendPatch({
            op: 'add',
            path: 'process-card',
            value: {component: 'text', id: 'status-text', text: 'Setting up environment...'},
        });
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Update the Text
        sendPatch({
            op: 'update',
            targetId: 'status-text',
            value: {component: 'text', id: 'status-text', text: 'Loading resources...'},
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Add a Loading indicator inside the Card
        sendPatch({
            op: 'add',
            path: 'process-card',
            value: {component: 'loading', id: 'loader', variant: 'dots'},
        });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update the Card title to show success
        sendPatch({
            op: 'update',
            targetId: 'process-card',
            value: {component: 'card', id: 'process-card', title: '✅ Setup Complete'},
        });

        // Remove the old status text
        sendPatch({
            op: 'remove',
            targetId: 'status-text'
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Replace loader with final Text
        sendPatch({
            op: 'update',
            targetId: 'loader',
            value: {component: 'text', id: 'final-text', text: 'System is ready for use.'},
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Divider before results section
        sendPatch({
            op: 'add',
            path: 'main-box',
            value: {component: 'divider', id: 'results-divider', orientation: 'horizontal', label: 'Results Overview'},
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Spacer for layout
        sendPatch({
            op: 'add',
            path: 'main-box',
            value: {component: 'spacer', id: 'spacer-1', size: '2rem'},
        });

        // Add Grid layout
        sendPatch({
            op: 'add',
            path: 'main-box',
            value: {
                component: 'grid',
                id: 'result-grid',
                columns: 2,
                gap: '1rem',
                children: {
                    items: [
                        {
                            component: 'image',
                            id: 'success-image',
                            src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ2m5lrUnvYTjtpAQlMry8arqTYivCPiRYfkA&s',
                            alt: 'Setup complete illustration',
                            caption: 'All systems are operational',
                            fit: 'cover'
                        },
                        {
                            component: 'progress',
                            id: 'progress-bar',
                            value: 70,
                            variant: 'linear',
                            label: 'Processing',
                            indeterminate: false,
                        },
                        {
                            component: 'badge',
                            id: 'status-badge',
                            text: 'Stable',
                            variant: 'success',
                            icon: {
                                component: 'icon',
                                name: 'check_circle',
                                variant: 'filled',
                                position: 'left',
                                size: '1em',
                            }
                        },
                        {
                            component: 'button',
                            id: 'continue-btn',
                            label: 'Proceed',
                            action: 'next-step',
                            icon: {
                                component: 'icon',
                                name: 'arrow_forward',
                                variant: 'filled',
                                position: 'right',
                                size: '1.2em'
                            }
                        }
                    ]
                }
            },
        });

        sendFinalMessage(convId);
        closeStream();
        res.end();
    };

    simulateResponse().catch(err => {
        console.error('Error in simulateResponse:', err);
        res.end();
    });

    req.on('close', () => {
        console.log('Client disconnected.');
        res.end();
    });
});

app.use(express.json()); // ensure JSON body parsing

app.post('/api/llm-message', (req: Request, res: Response) => {
    const envelope = req.body;
    console.log('📩 Received user message:', envelope);
    res.status(200).json({status: 'ok'});
});

// --- static frontend (if any) ---
const frontendPath = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendPath));
app.get('*', (_, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Create HTTP server and attach WebSocket server ---
const server = http.createServer(app);

// Integrate ws upgrade handling on HTTP server
server.on('upgrade', (request, socket, head) => {
    // route path /ws (change if you prefer another path)
    const {url} = request;
    if (url === '/ws') {
        wss.handleUpgrade(request, socket as any, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Backend server listening on http://localhost:${PORT}`);
    console.log(`WS path available at ws://localhost:${PORT}/ws`);
});
