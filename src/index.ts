import {Registry} from './core/Registry';
import {Interpreter} from './core/Interpreter';
import {BaseUiComponent} from './components/BaseUiComponent';
import type {GenerativeUIConfig, Patch, Component, Children} from "./schema.ts";
import type {Transport, TransportOptions, Envelope, TransportEvent} from "./core/transport/types.ts";
import {SSETransport} from "./core/transport/SSETransport.ts";
import {WebSocketTransport} from "./core/transport/WebSocketTransport.ts";
import {ConversationStore} from "./core/conversation/ConversationStore.ts";
import {LocalStoragePersistence} from "./core/conversation/LocalStoragePersistence.ts";
import {ConversationManager} from "./core/conversation/ConversationManager.ts";

/**
 * Represents a high-level instance of the Generative UI library, providing a user-friendly API
 * to interact with the underlying components (Registry, Interpreter, Transport, ConversationStore, ConversationManager).
 */
type GenerativeUIInstance = {
    createConversation: (id?: string) => Promise<string>;
    sendMessage: (convId: string, message: string | { text?: string; [k: string]: any }) => Promise<void>;
    connect: () => Promise<void>;

    onMessage: (handler: (envelope: Envelope) => void) => void;
    onPatch: (handler: (patch: Patch) => void) => void;
    onControl: (handler: (control: any) => void) => void;
    onEvent: (handler: (event: TransportEvent) => void) => void;
    disconnect: () => void;

    getConversationHistory: (convId: string) => Promise<Envelope[]>;
    getRecentMessages: (convId: string, limit?: number) => Promise<Envelope[]>;
    getMessagesFrom: (convId: string, fromTurnId: string) => Promise<Envelope[]>;
    extractMessageContent: (messages: Envelope[]) => (string | Component | Children | undefined)[];
    getLastUserContext: (convId: string) => Promise<string | Component | Children | undefined>;

    conversationManager: ConversationManager;
    registry: Registry;
    interpreter: Interpreter;
    transport?: Transport;
};

const GenerativeUI = {
    /**
     * Low-level factory function to create and configure a `Registry` instance.
     * This is useful for advanced embedding scenarios where more control over
     * component registration and interpretation is required.
     * @returns A configured `Registry` instance.
     */
    createRegistry(): Registry {
        const registry = new Registry();
        const interpreter = new Interpreter(registry);
        registry.setInterpreter(interpreter);
        // BaseUiComponent relies on a globally set registry for dynamic loading.
        BaseUiComponent.setRegistry(registry);

        return registry;
    },

    /**
     * Factory function to create a `Transport` instance based on provided options.
     * Supports 'sse' for Server-Sent Events and 'websocket' for WebSockets.
     * @param options Configuration options specific to the transport type.
     * @returns A `Transport` instance.
     * @throws {Error} If an unsupported transport type is specified.
     */
    createTransport(options: TransportOptions): Transport {
        switch (options.type) {
            case 'sse':
                return new SSETransport(options as any);
            case 'websocket':
                return new WebSocketTransport(options as any);
            default:
                throw new Error(`Unsupported transport type: ${(options as any).type}`);
        }
    },

    /**
     * High-level bootstrap function that initializes the entire Generative UI stack.
     * It sets up the Registry, Interpreter, optional Transport, ConversationStore,
     * and ConversationManager, returning a facade (`GenerativeUIInstance`) for interaction.
     * @param config Configuration object for the Generative UI instance.
     * @returns A Promise that resolves with a `GenerativeUIInstance` ready for use.
     * @throws {Error} If the specified container element is not found.
     */
    async init(config: GenerativeUIConfig): Promise<GenerativeUIInstance> {
        const registry = this.createRegistry();
        const interpreter = registry.getInterpreter();

        const rootElement =
            typeof config.container === 'string'
                ? document.querySelector(config.container)
                : config.container;

        if (!rootElement) {
            throw new Error(`GenerativeUI.init: UI container element '${config.container}' not found.`);
        }
        // Clear the container's content by default, unless explicitly set to false
        if (config.clearContainer !== false) {
            (rootElement as HTMLElement).innerHTML = '';
        }

        const providedTransportConfig = config.transport;
        // Type guard to distinguish between TransportOptions and an already instantiated Transport object
        const isTransportOptions = (v: any): v is TransportOptions =>
            v && typeof v === 'object' && typeof v.type === 'string';

        let transport: Transport | undefined;
        if (providedTransportConfig) {
            transport = isTransportOptions(providedTransportConfig)
                ? this.createTransport(providedTransportConfig)
                : (providedTransportConfig as Transport);
        }

        // Initialize ConversationStore with LocalStoragePersistence if enabled in config
        const store = new ConversationStore(
            config.enableLocalPersistence ? new LocalStoragePersistence() : undefined
        );
        // BaseUiComponent needs access to the conversation store for some features (e.g., history lookup, actions)
        BaseUiComponent.setConversationStore(store);

        // Ensure renderTarget is explicitly HTMLElement or ShadowRoot for type safety
        const renderTarget: HTMLElement | ShadowRoot = rootElement as HTMLElement | ShadowRoot;

        const conversationManager = new ConversationManager(
            interpreter,
            renderTarget,
            store,
            transport
        );

        return {
            // Advanced access for debugging or highly custom integrations
            registry,
            interpreter,
            transport,
            conversationManager,

            // High-level, user-friendly APIs
            createConversation: (id?: string) => conversationManager.startConversation(id),

            sendMessage: (convId: string, message: string | { text?: string; [k: string]: any }) => {
                // Normalize message input: string becomes { text: string }
                return conversationManager.sendMessage(convId, typeof message === 'string' ? { text: message } : message);
            },

            getConversationHistory: (convId: string) =>
                conversationManager.getMessages(convId),

            getRecentMessages: (convId: string, limit: number = 5) =>
                conversationManager.getMessages(convId, { limit }),

            getMessagesFrom: (convId: string, fromTurnId: string) =>
                conversationManager.getMessages(convId, { fromTurnId }),

            extractMessageContent: (messages: Envelope[]) => // Typed as Envelope[]
                messages.map(envelope => envelope.payload?.content).filter(Boolean) as (string | Component | Children | undefined)[], // Explicit cast for content array

            getLastUserContext: async (convId: string) => {
                const messages = await conversationManager.getMessages(convId);
                const lastUserMessage = messages
                    .filter(env => env.payload?.role === 'user')
                    .pop();
                return lastUserMessage?.payload?.content as string | Component | Children | undefined; // Explicit cast
            },

            connect: async () => {
                // Safely call transport.open() if transport exists and implements it
                if (transport && typeof transport.open === 'function') {
                    await transport.open();
                } else if (transport) {
                    console.warn("GenerativeUI: Configured transport does not have an 'open' method.");
                } else {
                    console.log("GenerativeUI: No transport configured, 'connect' is a no-op.");
                }
            },

            // Event proxies for transport events. Uses optional chaining for robustness.
            onMessage: (handler: (envelope: Envelope) => void) => transport?.onMessage?.(handler),
            onPatch: (handler: (patch: Patch) => void) => transport?.onPatch?.(handler),
            onControl: (handler: (control: any) => void) => transport?.onControl?.(handler), // 'any' pending control payload type
            onEvent: (handler: (event: TransportEvent) => void) => transport?.onEvent?.(handler),

            disconnect: () => {
                // Safely call transport.close() if transport exists and implements it
                if (transport && typeof transport.close === 'function') {
                    transport.close();
                } else if (transport) {
                    console.warn("GenerativeUI: Configured transport does not have a 'close' method.");
                } else {
                    console.log("GenerativeUI: No transport configured, 'disconnect' is a no-op.");
                }
            },
        };
    },
};

export default GenerativeUI;
