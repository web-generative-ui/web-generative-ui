import {Registry} from './core/Registry';
import {Interpreter} from './core/Interpreter';
import {BaseUiComponent} from './components/BaseUiComponent';
import type {GenerativeUIConfig} from "./schema.ts";
import type {Transport, TransportOptions} from "./core/transport/types.ts";
import {SSETransport} from "./core/transport/SSETransport.ts";
import {WebSocketTransport} from "./core/transport/WebSocketTransport.ts";
import {ConversationStore} from "./core/conversation/ConversationStore.ts";
import {LocalStoragePersistence} from "./core/conversation/LocalStoragePersistence.ts";
import {ConversationManager} from "./core/conversation/ConversationManager.ts";

type GenerativeUIInstance = {
    createConversation: (id?: string) => Promise<string>;
    sendMessage: (convId: string, message: string) => Promise<void>;
    connect: () => Promise<void>;
    onMessage: (cb: (envelope: any) => void) => void;
    onPatch: (cb: (patch: any) => void) => void;
    onControl: (cb: (control: any) => void) => void;
    onEvent: (cb: (ev: any) => void) => void;
    disconnect: () => void;
    getConversationHistory: (convId: string) => Promise<any[]>;
    getRecentMessages: (convId: string, limit?: number) => Promise<any[]>;
    getMessagesFrom: (convId: string, fromTurnId: string) => Promise<any[]>;
    extractMessageContent: (messages: any[]) => any[];
    getLastUserContext: (convId: string) => Promise<any>;

    conversationManager: ConversationManager;
    registry: Registry;
    interpreter: Interpreter;
    transport?: Transport;
};

const GenerativeUI = {
    /**
     * Low-level factory for advanced embedding use cases.
     */
    createRegistry(): Registry {
        const registry = new Registry();
        const interpreter = new Interpreter(registry);
        registry.setInterpreter(interpreter);
        BaseUiComponent.setRegistry(registry);
        return registry;
    },

    /**
     * Transport factory.
     */
    createTransport(options: TransportOptions): Transport {
        // Allow shorthand: { type: 'auto', wsUrl, sse: { streamURL, sendURL } }
        if ((options as any).type === 'auto') {
            const opts = options as any;
            // prefer ws
            try {
                const ws = new WebSocketTransport({ url: opts.wsUrl, reconnectPolicy: opts.reconnectPolicy });
                // attempt to open immediately; if it fails, fallback below
                ws.open().catch(() => {
                    console.warn('Failed to connect to WebSocket, falling back to SSE');
                });
                return ws;
            } catch (_) {
                console.warn('Failed to connect to WebSocket, falling back to SSE');
            }
        }

        switch (options.type) {
            case 'sse':
                return new SSETransport(options as any);
            case 'websocket':
                return new WebSocketTransport(options as any);
            default:
                throw new Error(`Unsupported transport type`);
        }
    },

    /**
     * High-level bootstrap: creates a UI instance bound to one transport/server.
     */
    async init(opts: GenerativeUIConfig): Promise<GenerativeUIInstance> {
        const registry = this.createRegistry();
        const interpreter = registry.getInterpreter();

        const rootEl =
            typeof opts.container === 'string'
                ? document.querySelector(opts.container)
                : opts.container;

        if (!rootEl) throw new Error('GenerativeUI.start: container not found');
        if (opts.clearContainer !== false) (rootEl as HTMLElement).innerHTML = '';

        const provided = opts.transport as Transport | TransportOptions | undefined;
        const isTransportOptions = (v: any): v is TransportOptions =>
            v && typeof v === 'object' && typeof v.type === 'string';

        let transport: Transport | undefined;
        if (provided) {
            transport = isTransportOptions(provided)
                ? this.createTransport(provided)
                : (provided as Transport);
        }

        const store = new ConversationStore(
            (opts as any).enableLocalPersistence ? new LocalStoragePersistence() : undefined
        );

        const conversationManager = new ConversationManager(
            interpreter,
            rootEl as HTMLElement,
            store,
            transport
        );

        return {
            // advanced access (optional)
            registry,
            interpreter,
            transport,
            conversationManager,

            // high-level APIs (user-friendly)
            createConversation: (id?: string) => conversationManager.startConversation(id),

            // normalize string => { text } and forward to the internal API
            sendMessage: (convId: string, msg: string | { text?: string; [k: string]: any }) => {
                conversationManager.clearContainer()
                return conversationManager.sendMessage(convId, typeof msg === 'string' ? { text: msg } : msg)
            },

            getConversationHistory: (convId: string) =>
                conversationManager.getMessages(convId),

            getRecentMessages: (convId: string, limit: number = 5) =>
                conversationManager.getMessages(convId, { limit }),

            getMessagesFrom: (convId: string, fromTurnId: string) =>
                conversationManager.getMessages(convId, { fromTurnId }),

            // Helper to extract just the content from messages
            extractMessageContent: (messages: any[]) =>
                messages.map(envelope => envelope.payload?.content).filter(Boolean),

            // Helper to get the last user message context
            getLastUserContext: async (convId: string) => {
                const messages = await conversationManager.getMessages(convId);
                const lastUserMessage = messages
                    .filter(env => env.payload?.role === 'user')
                    .pop();
                return lastUserMessage?.payload?.content;
            },

            // open the underlying transport (safe no-op if missing)
            connect: async () => {
                if (transport && typeof (transport as any).open === 'function') {
                    await (transport as any).open();
                }
            },

            // event proxies that do nothing if transport is absent
            onMessage: (cb: (envelope: any) => void) => transport?.onMessage?.(cb),
            onPatch: (cb: (patch: any) => void) => transport?.onPatch?.(cb),
            onControl: (cb: (control: any) => void) => transport?.onControl?.(cb),

            // generic event hook if needed
            onEvent: (cb: (ev: any) => void) => transport?.onEvent?.(cb),

            // disconnect / cleanup
            disconnect: () => {
                if ((transport as any)?.close) (transport as any).close();
            },
        };
    },
};

export default GenerativeUI;
