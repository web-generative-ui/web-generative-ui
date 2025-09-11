import type {Envelope} from "../transport/types.ts";

/**
 * Defines the contract for a strategy that provides persistent storage for conversation data.
 * Implementations of this interface handle the actual storage and retrieval of `Envelope` messages,
 * ensuring conversations can survive application restarts or be loaded across sessions.
 */
export interface PersistenceStrategy {
    createConversation(convId: string): Promise<void>;

    appendMessage(incomingEnvelope: Envelope): Promise<void>;

    getMessages(convId: string): Promise<Envelope[]>;

    clearMessages(convId: string): Promise<void>;
}

/**
 * Manages conversation history, providing in-memory caching and optional persistent storage.
 * It acts as a central repository for messages, allowing retrieval, appending, and clearing of conversations.
 * It also includes an event system to notify subscribers of conversation updates.
 */
export class ConversationStore {
    /**
     * An in-memory cache for conversation messages, indexed by conversation ID.
     * This optimizes read access by reducing reliance on the (potentially slower) persistence layer.
     * @private
     */
    private memoryStore: Map<string, Envelope[]>;

    private listeners: Map<string, ((...args: any[]) => void)[]> = new Map();
    /**
     * An optional `PersistenceStrategy` instance used to store and retrieve conversations
     * beyond the current session (e.g., in `localStorage` or IndexedDB).
     * @private
     */
    private readonly persistence?: PersistenceStrategy;

    /**
     * Creates an instance of ConversationStore.
     * @param persistence An optional `PersistenceStrategy` implementation for persistent storage.
     */
    constructor(persistence?: PersistenceStrategy) {
        this.memoryStore = new Map();
        this.persistence = persistence;
    }

    /**
     * Creates a new conversation with a generated or provided ID.
     * Initializes an empty message array in the in-memory store and optionally in persistent storage.
     * @param id An optional pre-defined unique identifier for the new conversation. If not provided, a new one is generated.
     * @returns A Promise that resolves with the unique ID of the newly created conversation.
     * @throws {Error} If a conversation with the provided ID already exists.
     */
    async createConversation(id?: string): Promise<string> {
        const convId = id || this.generateId();
        if (this.memoryStore.has(convId)) {
            throw new Error(`Conversation ${convId} already exists`);
        }

        this.memoryStore.set(convId, []);

        if (this.persistence) {
            await this.persistence.createConversation(convId);
        }

        return convId;
    }

    /**
     * Appends an `Envelope` message to a conversation's history.
     * If the conversation does not exist in memory, it will be lazily created.
     * The message is added to both the in-memory cache and, if configured, the persistent store.
     * An 'update' event is emitted after the message is appended.
     * @param incomingEnvelope The message `Envelope` to append. Must contain a `convId`.
     * @returns A Promise that resolves when the message has been appended and stores updated.
     */
    async appendMessage(incomingEnvelope: Envelope): Promise<void> {
        if (!incomingEnvelope.convId) {
            console.warn("ConversationStore: Attempted to append message without convId. Message will not be stored.");
            return;
        }

        const convId = incomingEnvelope.convId;

        if (!this.memoryStore.has(convId)) {
            await this.createConversation(convId);
        }

        const messages = this.memoryStore.get(convId)!;
        messages.push(incomingEnvelope);

        if (this.persistence) {
            await this.persistence.appendMessage(incomingEnvelope);
        }

        this._emit('update', convId, incomingEnvelope);
    }

    /**
     * Appends an `Envelope` to the conversation history, specifically filtering for `message` type envelopes.
     * This acts as a convenience method to only store actual communication messages, ignoring other envelope types.
     * @param incomingEnvelope The `Envelope` to consider for appending. Only `type: 'message'` envelopes with a `convId` are processed.
     * @returns A Promise that resolves when the envelope has been processed (appended or ignored).
     */
    async appendFromEnvelope(incomingEnvelope: any): Promise<void> {
        if (incomingEnvelope?.type !== 'message' || !incomingEnvelope?.convId) {
            return;
        }

        await this.appendMessage(incomingEnvelope);
    }

    /**
     * Registers a callback function to be invoked when a specific event occurs.
     * @param event The name of the event to listen for (e.g., 'update').
     * @param handler The callback function to register. Its arguments depend on the event type.
     */
    public on(event: string, handler: (...args: any[]) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(handler);
    }

    /**
     * Unregisters a previously registered callback function for a specific event.
     * @param event The name of the event from which to remove the handler.
     * @param handler The callback function to unregister.
     */
    public off(event: string, handler: (...args: any[]) => void): void {
        const callbacks = this.listeners.get(event);
        if (!callbacks) {
            return;
        }
        const index = callbacks.indexOf(handler);
        if (index !== -1) {
            callbacks.splice(index, 1);
            if (callbacks.length === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * Dispatches an event to all registered handlers for that event type.
     * @private
     * @param event The name of the event to emit.
     * @param args Any arguments to pass to the event handlers.
     */
    private _emit(event: string, ...args: any[]): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            Array.from(handlers).forEach(handler => {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`Error in ConversationStore event handler for '${event}':`, error);
                }
            });
        }
    }

    /**
     * Retrieves the history (messages) for a specific conversation, with optional filtering and limiting.
     * It prioritizes fetching from the in-memory cache. If not found, it attempts to load from persistence
     * and caches the result.
     * @param convId The unique identifier of the conversation.
     * @param options Filtering and pagination options:
     *   `limit`: Optional. The maximum number of messages to return (from the end of the history).
     *   `fromTurnId`: Optional. If provided, messages are returned starting from the message with this `turnId` (inclusive).
     * @returns A Promise that resolves with an array of `Envelope` objects representing the filtered conversation history.
     */
    async getHistory(convId: string, options: { limit?: number; fromTurnId?: string } = {}): Promise<Envelope[]> {
        let messages: Envelope[] = [];

        if (this.memoryStore.has(convId)) {
            messages = this.memoryStore.get(convId)!;
        } else if (this.persistence) {
            messages = await this.persistence.getMessages(convId);
            this.memoryStore.set(convId, messages);
        } else {
            return [];
        }

        if (options.fromTurnId) {
            const index = messages.findIndex(envelope => envelope?.turnId === options.fromTurnId);
            messages = index >= 0 ? messages.slice(index) : [];
        }

        if (options.limit !== undefined) {
            messages = messages.slice(-options.limit);
        }

        return messages;
    }

    /**
     * Clears all messages for a specific conversation from both the in-memory cache and the persistent store.
     * @param convId The unique identifier of the conversation to clear.
     * @returns A Promise that resolves when the conversation data has been removed from both stores.
     */
    async clear(convId: string): Promise<void> {
        this.memoryStore.delete(convId);

        if (this.persistence) {
            await this.persistence.clearMessages(convId);
        }
    }

    /**
     * Generates a simple, short, pseudo-random string ID for new conversations.
     * @private
     * @returns A unique conversation ID string.
     */
    private generateId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}
