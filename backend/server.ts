import express from 'express';
import path from 'path';
import cors from 'cors';
import {Request, Response} from 'express';
import {WebSocketServer, WebSocket} from 'ws';
import http from 'http';
import {Badge, LayoutMeta, Link, Loading, Patch, Progress, Reference, Table, Tabs, Video} from "./schema";
import type {
    Box,
    Button,
    Card,
    Carousel,
    CollapseBlock,
    Component,
    Divider,
    Icon,
    Image,
    Text,
    Timeline,
    Stream
} from "./schema"

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

function makeLayoutMeta(): LayoutMeta {
    return {
        span: maybe(0.5) ? pick([1, 2, 3, 4, 'auto', '1fr']) : undefined,
        order: maybe(0.5) ? rnd(-2, 5) : undefined,
        align: maybe(0.5) ? pick(['start', 'center', 'end', 'stretch']) : undefined,
        grow: maybe(0.5) ? rnd(0, 3) : undefined,
        basis: maybe(0.5) ? `${rnd(100, 300)}px` : undefined,
        area: maybe(0.3) ? `area-${randId()}` : undefined,
    };
}

// Create atomic components
function makeText(): Text {
    const component: Text = {
        component: 'text',
        text: lorem(8),
        variant: maybe(0.5) ? pick(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'subtitle', 'body', 'caption', 'overline', 'highlight-info', 'highlight-warning', 'highlight-error', 'highlight-success', 'highlight-accent']) : undefined,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeImage(): Image {
    const component: Image = {
        component: 'image',
        src: randImgUrl(),
        alt: lorem(3),
        caption: maybe(0.5) ? lorem(5) : undefined,
        fit: maybe(0.5) ? pick(['cover', 'contain', 'fill', 'none', 'scale-down']) : undefined,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeVideo(): Video {
    const component: Video = {
        component: 'video',
        src: randVideoUrl(),
        poster: maybe(0.5) ? randImgUrl() : undefined,
        controls: maybe(0.8),
        autoplay: maybe(0.3),
        loop: maybe(0.4),
        muted: maybe(0.5),
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeButton(): Button {
    const component: Button = {
        component: 'button',
        label: pick(['OK', 'Submit', 'Open', 'More', 'View']),
        action: maybe(0.7) ? randUrl() : undefined,
        icon: maybe(0.5) ? { ...makeIcon(), position: pick(['left', 'right']) } : undefined,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeLink(): Link {
    const component: Link = {
        component: 'link',
        href: randUrl(),
        target: maybe(0.5) ? pick(['_blank', '_self', '_parent', '_top']) : undefined,
        children: maybe(0.8) ? [makeText()] : [],
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeBadge(): Badge {
    const component: Badge = {
        component: 'badge',
        text: pick(['new', 'beta', 'info', 'urgent']),
        variant: maybe(0.5) ? pick(['info', 'success', 'warning', 'error', 'neutral']) : undefined,
        icon: maybe(0.4) ? { ...makeIcon(), position: pick(['left', 'right']), size: maybe(0.5) ? 'small' : undefined } : undefined,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeProgress(): Progress {
    const component: Progress = {
        component: 'progress',
        value: maybe(0.8) ? rnd(0, 100) : undefined,
        variant: maybe(0.5) ? pick(['linear', 'circular']) : undefined,
        label: maybe(0.4) ? lorem(3) : undefined,
        indeterminate: maybe(0.2),
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeLoading(): Loading {
    const component: Loading = {
        component: 'loading',
        message: maybe(0.6) ? lorem(4) : undefined,
        variant: maybe(0.5) ? pick(['spinner', 'skeleton', 'dots', 'bar']) : undefined,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeDivider(): Divider {
    const component: Divider = {
        component: 'divider',
        orientation: maybe(0.5) ? pick(['horizontal', 'vertical']) : undefined,
        label: maybe(0.4) ? lorem(2) : undefined,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeIcon(): Icon {
    const component: Icon = {
        component: 'icon',
        name: pick(['check', 'clock', 'user', 'alert', 'star']),
        variant: maybe(0.5) ? pick(['outlined', 'filled', 'rounded', 'sharp']) : undefined,
        size: maybe(0.5) ? pick(['small', 'medium', 'large']) : undefined,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeReference(): Reference {
    const component: Reference = {
        component: 'reference',
        label: lorem(2),
        target: randUrl(),
        description: maybe(0.4) ? lorem(10) : undefined,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeCard(depth: number, maxDepth: number): Card {
    const children = maybe(0.8) ? makeChildrenArray(depth + 1, maxDepth) : undefined;
    const component: Card = {
        component: 'card',
        title: lorem(3),
        children,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

// Complex / container components
function makeBox(depth: number, maxDepth: number): Box {
    const children = makeChildrenArray(depth + 1, maxDepth);
    const component: Box = {
        component: 'box',
        direction: maybe(0.5) ? pick(['row', 'column']) : undefined,
        gap: maybe(0.5) ? `${rnd(1, 4)}rem` : undefined,
        align: maybe(0.5) ? pick(['start', 'center', 'end', 'stretch']) : undefined,
        justify: maybe(0.5) ? pick(['start', 'center', 'end', 'space-between', 'space-around']) : undefined,
        wrap: maybe(0.5) ? true : undefined,
        children,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeCollapseBlock(depth: number, maxDepth: number): CollapseBlock {
    const content = makeChildrenArray(depth + 1, maxDepth);
    const component: CollapseBlock = {
        component: 'collapse-block',
        title: lorem(3),
        collapsed: maybe(0.5),
        content,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeTabs(depth: number, maxDepth: number): Tabs {
    const tabCount = rnd(1, 4);
    const tabs = new Array(tabCount).fill(null).map((_, i) => ({
        id: randId('t'),
        label: `Tab ${i + 1}`,
        content: makeChildrenArray(depth + 1, maxDepth),
    }));
    const component: Tabs = {
        component: 'tabs',
        tabs,
        'active-tab': pick(tabs).id,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeCarousel(depth: number, maxDepth: number): Carousel {
    const itemCount = rnd(1, 5);
    const items = new Array(itemCount).fill(null).map(() => pick([makeImage(), makeCard(depth, maxDepth), makeVideo()]));
    const component: Carousel = {
        component: 'carousel',
        autoplay: maybe(0.5),
        interval: pick([2000, 3000, 5000]),
        items,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeTimeline(): Timeline {
    const count = rnd(2, 6);
    const statuses = ['completed', 'active', 'upcoming', 'default'] as const;
    const items = new Array(count).fill(null).map(() => ({
        time: new Date(Date.now() - rnd(-10000000, 10000000)).toISOString(),
        title: lorem(4),
        description: maybe(0.6) ? lorem(8) : undefined,
        icon: maybe(0.4) ? makeIcon() : undefined,
        media: maybe(0.3) ? pick([makeImage(), makeVideo()]) : undefined,
        status: pick(statuses),
        extra: maybe(0.2) ? { custom: lorem(2) } : undefined,
    }));
    const component: Timeline = {
        component: 'timeline',
        orientation: pick(['vertical', 'horizontal']),
        items,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeStream(depth: number, maxDepth: number): Stream {
    const count = rnd(1, 6);
    const items = new Array(count).fill(null).map(() => {
        const contentIsString = maybe(0.5);

        // Create content with explicit typing
        let content: string | Text | Card | Image | Video;

        if (contentIsString) {
            content = lorem(12);
        } else {
            // Randomly select a component type to create
            const componentType = pick(['text', 'card', 'image', 'video', 'codeblock']);

            switch (componentType) {
                case 'text':
                    content = makeText();
                    break;
                case 'card':
                    content = makeCard(depth, maxDepth);
                    break;
                case 'image':
                    content = makeImage();
                    break;
                case 'video':
                    content = makeVideo();
                    break;
                default:
                    // This should never happen, but provides a fallback
                    content = lorem(12);
            }
        }

        // Create the item with proper typing
        const item: {
            id?: string;
            timestamp?: string;
            author?: string;
            content: string | Text | Card | Image | Video;
            status?: 'pending' | 'completed' | 'error';
            extra?: { [k: string]: any };
            key?: string;
        } = {
            content,
        };

        // Add optional properties conditionally
        if (maybe(0.8)) item.id = randId('s');
        if (maybe(0.7)) item.timestamp = new Date().toISOString();
        if (maybe(0.6)) item.author = pick(['system', 'assistant', 'user']);
        if (maybe(0.5)) item.status = pick(['pending', 'completed', 'error']);
        if (maybe(0.2)) item.extra = { custom: lorem(2) };
        if (maybe(0.5)) item.key = randId('key-');

        return item;
    });

    const component: Stream = {
        component: 'stream',
        items,
    };

    // Add optional properties conditionally
    if (maybe(0.5)) component.direction = pick(['up', 'down']);
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');

    return component;
}

function makeTable(depth: number, maxDepth: number): Table {
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
    const children = maybe(0.4) ? makeChildrenArray(depth + 1, maxDepth) : undefined;
    const component: Table = {
        component: 'table',
        data,
        columns,
        children,
    };
    if (maybe(0.3)) component.layout = makeLayoutMeta();
    if (maybe(0.2)) component.key = randId('key-');
    return component;
}

function makeChildrenArray(depth: number, maxDepth: number): Component[] {
    const count = rnd(1, 4);
    const out: Component[] = [];
    for (let i = 0; i < count; i++) {
        out.push(makeRandomComponent(depth, maxDepth));
    }
    return out;
}

function makeRandomComponent(depth = 0, maxDepth = 3): Component {
    // If deep enough, bias towards leaf nodes
    const leafBias = depth >= maxDepth ? 0.9 : 0.3;
    const leafPool: (() => Component)[] = [
        makeText, makeImage, makeVideo, makeButton, makeLink, makeBadge, makeProgress, makeLoading, makeDivider, makeIcon, makeReference
    ];
    const containerPool: ((depth: number, maxDepth: number) => Component)[] = [
        makeCard, makeBox, makeCollapseBlock, makeTabs, makeCarousel, makeTimeline, makeStream, makeTable
    ];

    if (Math.random() < leafBias) {
        return pick(leafPool)();
    }

    // randomly choose a container or card (card may include children)
    const chosen = pick(containerPool);
    return chosen(depth, maxDepth);
}

function generateRandomComponents(count = 3, maxDepth = 3): Component[] {
    const out: Component[] = [];
    for (let i = 0; i < count; i++) out.push(makeRandomComponent(0, maxDepth));
    return out;
}

// ===== END TEST DATA GENERATOR =====

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
