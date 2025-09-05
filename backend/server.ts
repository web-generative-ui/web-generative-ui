import express from 'express';
import path from 'path';
import cors from 'cors';
import { Request, Response } from 'express';

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

const frontendPath = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendPath));

app.get('/api/llm-stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    console.log('Client connected for SSE stream.');

    const sendPatch = (patch: Patch) => {
        const data = `data: ${JSON.stringify(patch)}\n\n`;
        res.write(data);
    };

    const closeStream = () => {
        res.write('event: close\n\n');
    };

    const simulateResponse = async () => {
        // Add a Box container
        sendPatch({
            op: 'add',
            path: null,
            value: { component: 'box', id: 'main-box' },
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Add a Card inside the Box
        sendPatch({
            op: 'add',
            path: 'main-box',
            value: { component: 'card', id: 'process-card', title: '⚡ Initializing...' },
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Add a Text inside the Card
        sendPatch({
            op: 'add',
            path: 'process-card',
            value: { component: 'text', id: 'status-text', text: 'Setting up environment...' },
        });
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Update the Text
        sendPatch({
            op: 'update',
            targetId: 'status-text',
            value: { component: 'text', id: 'status-text', text: 'Loading resources...' },
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Add a Loading indicator inside the Card
        sendPatch({
            op: 'add',
            path: 'process-card',
            value: { component: 'loading', id: 'loader', variant: 'dots' },
        });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update the Card title to show success
        sendPatch({
            op: 'update',
            targetId: 'process-card',
            value: { component: 'card', id: 'process-card', title: '✅ Setup Complete' },
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
            value: { component: 'text', id: 'final-text', text: 'System is ready for use.' },
        });

        closeStream();
        res.end();
    };

    simulateResponse();

    req.on('close', () => {
        console.log('Client disconnected.');
        res.end();
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Backend server listening on http://localhost:${PORT}`);
});
