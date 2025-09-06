import { Registry } from './core/Registry';
import { Interpreter } from './core/Interpreter';
import { BaseUiComponent } from './components/BaseUiComponent';
import type { GenerativeUIConfig } from "./schema.ts";
import type {Transport, TransportOptions} from "./core/transport/types.ts";
import {SSETransport} from "./core/transport/SSETransport.ts";
import {WebSocketTransport} from "./core/transport/WebSocketTransport.ts";
import {ConversationStore} from "./core/conversation/ConversationStore.ts";
import {LocalStoragePersistence} from "./core/conversation/LocalStoragePersistence.ts";
import {ConversationManager} from "./core/conversation/ConversationManager.ts";

const GenerativeUI = {
    /**
     * Low-level factory (kept for advanced use)
     */
    create(): Registry {
        const registry = new Registry();
        const interpreter = new Interpreter(registry);
        registry.setInterpreter(interpreter);
        BaseUiComponent.setRegistry(registry);
        return registry;
    },

    /**
     * Set up transport with options.
     */
    createTransport(options: TransportOptions): Transport {
        switch (options.type) {
            case 'sse':
                return new SSETransport(options);
            case 'websocket':
                return new WebSocketTransport(options);
            default:
                throw new Error(`Unsupported transport type`);
        }
    },

    /**
     * High-level bootstrap: sets up Registry+Interpreter, binds a container,
     * and streams patches/envelopes from Transport or EventSource to the Interpreter.
     */
    async start(opts: GenerativeUIConfig) {
        const registry = this.create();
        const interpreter = registry.getInterpreter();

        const rootEl =
            typeof opts.container === 'string'
                ? document.querySelector(opts.container)
                : opts.container;

        if (!rootEl) throw new Error('GenerativeUI.start: container not found');

        if (opts.clearContainer !== false) (rootEl as HTMLElement).innerHTML = '';

        // Accept either a Transport instance or TransportOptions
        const provided = opts.transport as Transport | TransportOptions | undefined;

        const isTransportOptions = (v: any): v is TransportOptions =>
            v && typeof v === 'object' && typeof v.type === 'string';

        let transport: Transport | undefined;

        if (provided) {
            if (isTransportOptions(provided)) {
                transport = this.createTransport(provided);
            } else {
                transport = provided as Transport;
            }
        }
        const store = new ConversationStore((opts as any).enableLocalPersistence ? new LocalStoragePersistence() : undefined );

        const conversationManager = new ConversationManager(interpreter, rootEl as HTMLElement, store, transport);

        if (transport) {
            await conversationManager.startConversation();

            if ((transport as any).open && typeof (transport as any).open === 'function') {
                (transport as any).open().catch((err: unknown) => {
                    if (opts.onError) opts.onError(err, undefined);
                    else console.error('Failed to open transport', err);
                });
            }

            return {
                registry,
                interpreter,
                transport,
                conversationManager,
                stop: () => {
                    if ((transport as any).close) (transport as any).close();
                },
            };
        }

        // Legacy EventSource path (still supported). streamUrl is required here.
        if (!opts.streamUrl) throw new Error('GenerativeUI.start: streamUrl is required when no transport is provided');

        const es = new EventSource(opts.streamUrl, opts.eventSourceInit);
        if (opts.onOpen) es.addEventListener('open', () => opts.onOpen!(es));

        es.onmessage = async (ev) => {
            try {
                const envelope = JSON.parse(ev.data);
                if (envelope && envelope.type === 'patch') {
                    await interpreter.applyPatch(rootEl as HTMLElement, envelope.payload);
                } else {
                    await interpreter.handleEnvelope(rootEl as HTMLElement, envelope);
                }
            } catch (err: unknown) {
                if (opts.onError) opts.onError(err, ev.data);
                else console.error('Failed to handle message', err, ev.data);
            }
        };

        const handleClose = () => {
            es.close();
            if (opts.onClose) opts.onClose();
        };

        es.addEventListener('close', handleClose);
        es.onerror = () => handleClose();

        return {
            registry,
            interpreter,
            eventSource: es,
            stop: handleClose,
        };
    },
};

export default GenerativeUI;
