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

// ===== INTEGRATED TEST DATA GENERATOR =====

// Helper utilities [random generation]
function rnd(min = 0, max = 1) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
function maybe(p = 0.5) {
    return Math.random() < p;
}
function randId(prefix = '') {
    return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}
function lorem(words = 6) {
    const sample = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor'.split(' ');
    let out = [];
    for (let i = 0; i < words; i++) out.push(pick(sample));
    return out.join(' ');
}
function randImgUrl() {
    return `https://picsum.photos/seed/${Math.random().toString(36).slice(2,8)}/800/450`;
}
function randVideoUrl() {
    return `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4`;
}
function randUrl() {
    return `https://example.com/${Math.random().toString(36).slice(2,8)}`;
}

// Create atomic components
function makeText() {
    return {
        component: 'text',
        text: lorem(8),
    };
}

function makeImage() {
    return {
        component: 'image',
        src: randImgUrl(),
        alt: lorem(3),
    };
}

function makeVideo() {
    return {
        component: 'video',
        src: randVideoUrl(),
        poster: randImgUrl(),
        controls: true,
        autoplay: false,
        loop: false,
        muted: false,
    };
}

function makeButton() {
    return {
        component: 'button',
        label: pick(['OK', 'Submit', 'Open', 'More', 'View']),
        action: randUrl(),
    };
}

function makeLink() {
    return {
        component: 'link',
        label: lorem(2),
        href: randUrl(),
    };
}

function makeBadge() {
    return {
        component: 'badge',
        label: pick(['new', 'beta', 'info', 'urgent']),
    };
}

function makeProgress() {
    return {
        component: 'progress',
        value: rnd(0, 100),
        max: 100,
    };
}

function makeLoading() {
    return {
        component: 'loading',
        size: pick(['small', 'medium', 'large']),
    };
}

function makeDivider() {
    return {
        component: 'divider',
        style: pick(['solid', 'dashed', 'dotted']),
    };
}

function makeIcon() {
    return {
        component: 'icon',
        name: pick(['check', 'clock', 'user', 'alert', 'star']),
    };
}

function makeReference() {
    return {
        component: 'reference',
        label: lorem(2),
        target: randUrl(),
        description: maybe(0.4) ? lorem(10) : undefined,
    };
}

function makeCard(children?: any[]) {
    return {
        component: 'card',
        title: lorem(3),
        subtitle: maybe(0.6) ? lorem(4) : undefined,
        body: maybe(0.8) ? lorem(12) : undefined,
        media: maybe(0.5) ? makeImage() : undefined,
        actions: maybe(0.6) ? [makeButton(), makeLink()] : undefined,
        children: children ? { items: children } : undefined,
    };
}

// Complex / container components
function makeBox(depth: number, maxDepth: number) {
    const children = makeChildrenArray(depth + 1, maxDepth);
    return {
        component: 'box',
        title: maybe(0.5) ? lorem(3) : undefined,
        children: { items: children },
    };
}

function makeCollapseBlock(depth: number, maxDepth: number) {
    const children = makeChildrenArray(depth + 1, maxDepth);
    return {
        component: 'collapse-block',
        title: lorem(3),
        collapsed: maybe(0.5),
        content: children,
    };
}

function makeTabs(depth: number, maxDepth: number) {
    const tabCount = rnd(1, 4);
    const tabs = new Array(tabCount).fill(null).map((_, i) => ({
        id: randId('t'),
        label: `Tab ${i + 1}`,
        content: makeChildrenArray(depth + 1, maxDepth),
    }));
    return {
        component: 'tabs',
        tabs,
        'active-tab': pick(tabs).id,
    };
}

function makeCarousel(depth: number, maxDepth: number) {
    const itemCount = rnd(1, 5);
    const items = new Array(itemCount).fill(null).map(() => pick([makeImage(), makeCard(), makeVideo()]));
    return {
        component: 'carousel',
        autoplay: maybe(0.5),
        interval: pick([2000, 3000, 5000]),
        items,
    };
}

function makeTimeline(depth: number, maxDepth: number) {
    const count = rnd(2, 6);
    const statuses = ['completed', 'active', 'upcoming', 'default'] as const;
    const items = new Array(count).fill(null).map(() => ({
        time: new Date(Date.now() - rnd(-10000000, 10000000)).toISOString(),
        title: lorem(4),
        description: maybe(0.6) ? lorem(8) : undefined,
        icon: maybe(0.4) ? makeIcon() : undefined,
        media: maybe(0.3) ? pick([makeImage(), makeVideo()]) : undefined,
        status: pick(statuses),
    }));
    return {
        component: 'timeline',
        orientation: pick(['vertical', 'horizontal']),
        items,
    };
}

function makeStream(depth: number, maxDepth: number) {
    const count = rnd(1, 6);
    const items = new Array(count).fill(null).map(() => {
        const contentIsString = maybe(0.5);
        return {
            id: randId('s'),
            timestamp: new Date().toISOString(),
            author: pick(['system', 'assistant', 'user']),
            content: contentIsString ? lorem(12) : pick([makeText(), makeCard(), makeImage(), makeVideo()]),
            status: pick(['pending', 'completed', 'error']),
        };
    });
    return {
        component: 'stream',
        direction: pick(['down', 'up']),
        items,
    };
}

function makeTable(depth: number, maxDepth: number) {
    const rows = rnd(1, 6);
    const columns = [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name' },
        { key: 'status', header: 'Status' },
    ];
    const data = new Array(rows).fill(null).map(() => ({
        id: randId('r'),
        name: lorem(2),
        status: pick(['ok', 'warn', 'fail']),
    }));
    const children = maybe(0.4) ? { items: makeChildrenArray(depth + 1, maxDepth) } : undefined;
    return {
        component: 'table',
        data,
        columns,
        children,
    };
}

function makeChildrenArray(depth: number, maxDepth: number): any[] {
    const count = rnd(1, 4);
    const out: any[] = [];
    for (let i = 0; i < count; i++) {
        out.push(makeRandomComponent(depth, maxDepth));
    }
    return out;
}

function makeRandomComponent(depth = 0, maxDepth = 3): any {
    // If deep enough, bias towards leaf nodes
    const leafBias = depth >= maxDepth ? 0.9 : 0.3;
    const leafPool = [
        makeText, makeImage, makeVideo, makeButton, makeLink, makeBadge, makeProgress, makeLoading, makeDivider, makeIcon, makeReference
    ];
    const containerPool = [
        makeCard, makeBox, makeCollapseBlock, makeTabs, makeCarousel, makeTimeline, makeStream, makeTable
    ];

    if (Math.random() < leafBias) {
        return pick(leafPool)();
    }

    // randomly choose a container or card (card may include children)
    const chosen = pick(containerPool);
    if (chosen === makeCard) return makeCard(makeChildrenArray(depth + 1, maxDepth));
    if (chosen === makeBox) return makeBox(depth, maxDepth);
    if (chosen === makeCollapseBlock) return makeCollapseBlock(depth, maxDepth);
    if (chosen === makeTabs) return makeTabs(depth, maxDepth);
    if (chosen === makeCarousel) return makeCarousel(depth, maxDepth);
    if (chosen === makeTimeline) return makeTimeline(depth, maxDepth);
    if (chosen === makeStream) return makeStream(depth, maxDepth);
    if (chosen === makeTable) return makeTable(depth, maxDepth);

    // fallback
    return makeText();
}

function generateRandomComponents(count = 3, maxDepth = 3): any[] {
    const out: any[] = [];
    for (let i = 0; i < count; i++) out.push(makeRandomComponent(0, maxDepth));
    return out;
}

// ===== END TEST DATA GENERATOR =====

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

    const closeStream = () => {
        res.write('event: close\n\n');
    };

    const simulateResponseWithRandomData = async () => {
        // Add a main container
        sendPatch({
            op: 'add',
            path: null,
            value: {component: 'box', id: 'main-container'},
        });
        await new Promise(resolve => setTimeout(resolve, 300));

        // Add initial status card
        sendPatch({
            op: 'add',
            path: 'main-container',
            value: {component: 'card', id: 'status-card', title: '🚀 Generating Content...'},
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Add loading indicator
        sendPatch({
            op: 'add',
            path: 'status-card',
            value: makeLoading(),
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update status
        sendPatch({
            op: 'update',
            targetId: 'status-card',
            value: {component: 'card', id: 'status-card', title: '⚡ Processing Data...'},
        });
        await new Promise(resolve => setTimeout(resolve, 800));

        // Generate and add random components
        const randomComponents = generateRandomComponents(rnd(2, 5), 2);

        for (let i = 0; i < randomComponents.length; i++) {
            const component = randomComponents[i];
            component.id = `generated-${i}-${randId()}`;

            sendPatch({
                op: 'add',
                path: 'main-container',
                value: component,
            });

            // Stagger the additions for dramatic effect
            await new Promise(resolve => setTimeout(resolve, rnd(300, 800)));
        }

        // Update final status
        sendPatch({
            op: 'update',
            targetId: 'status-card',
            value: {component: 'card', id: 'status-card', title: '✅ Content Generated Successfully'},
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Add a summary divider
        sendPatch({
            op: 'add',
            path: 'main-container',
            value: {
                component: 'divider',
                id: 'summary-divider',
                orientation: 'horizontal',
                label: `Generated ${randomComponents.length} Components`
            },
        });

        closeStream();
        res.end();
    };

    simulateResponseWithRandomData().catch(err => {
        console.error('Error in simulateResponseWithRandomData:', err);
        res.end();
    });

    req.on('close', () => {
        console.log('Client disconnected.');
        res.end();
    });
});

app.use(express.json());

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
const wss = new WebSocketServer({noServer: true});

// Handle WebSocket connections with random data
wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket client connected:', req.socket.remoteAddress);

    ws.on('message', (data) => {
        try {
            const envelope = JSON.parse(data.toString());
            console.log('WS recv:', envelope);

            const convId = envelope?.convId ?? 'unknown-conv';

            // Send acknowledgment message
            const ackEnvelope = {
                type: 'message',
                convId,
                turnId: 'srv-ack-' + Date.now(),
                payload: {
                    role: 'assistant',
                    content: {text: `Processing: ${String(envelope?.payload?.content?.text ?? '')}`}
                }
            };
            ws.send(JSON.stringify(ackEnvelope));

            // Send random components as patches
            setTimeout(() => {
                const randomComponent = makeRandomComponent(0, 2);
                randomComponent.id = `ws-${convId}-${Date.now()}`;

                const patch = {
                    op: 'add',
                    path: null,
                    value: randomComponent
                };
                ws.send(JSON.stringify({type: 'patch', convId, payload: patch}));
            }, 500);

            // Send another random component after delay
            setTimeout(() => {
                const randomComponent2 = makeRandomComponent(0, 1);
                randomComponent2.id = `ws-${convId}-${Date.now()}-2`;

                const patch = {
                    op: 'add',
                    path: null,
                    value: randomComponent2
                };
                ws.send(JSON.stringify({type: 'patch', convId, payload: patch}));
            }, 1200);
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

// Integrate ws upgrade handling on HTTP server
server.on('upgrade', (request, socket, head) => {
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
