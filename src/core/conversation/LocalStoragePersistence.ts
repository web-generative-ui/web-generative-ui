import type {PersistenceStrategy} from "./ConversationStore.ts";
import type {Envelope} from "../transport/types.ts";

/**
 * Implements the `PersistenceStrategy` interface using the browser's `localStorage`.
 * This strategy provides a simple, synchronous way to store and retrieve conversation messages
 * for a generative UI, indexed by conversation ID.
 *
 * Data is stored as JSON strings, with messages for each conversation stored as an array.
 * Note: `localStorage` is synchronous and blocking, and has limited storage capacity.
 * It is not suitable for large amounts of data or performance-critical operations.
 */
export class LocalStoragePersistence implements PersistenceStrategy{
    /**
     * A prefix string used to distinguish conversation keys in `localStorage` from other items.
     * @private
     */
    private readonly prefix: string;

    /**
     * Creates an instance of `LocalStoragePersistence`.
     * @param prefix The prefix string to use for `localStorage` keys. Defaults to 'generativeui:conv:'.
     */
    constructor(prefix = 'generativeui:conv:') {
        this.prefix = prefix;
    }

    /**
     * Ensures that a conversation entry exists in `localStorage`.
     * If the conversation identified by `convId` does not exist, an empty array is stored for it.
     * If it already exists, this method does nothing (it does not overwrite existing data).
     * @param convId The unique identifier of the conversation.
     * @returns A promise that resolves when the operation is complete.
     */
    async createConversation(convId: string): Promise<void> {
        const key = this.getKey(convId);
        if (localStorage.getItem(key) === null) {
            localStorage.setItem(key, JSON.stringify([]));
        }
    }
    /**
     * Appends a new message (an `Envelope`) to the message history of a specific conversation.
     * If the conversation does not exist, it will be initialized with the new message.
     * Messages are stored as a JSON string array in `localStorage`.
     * @param envelope The message `Envelope` to append. It must contain a `convId`.
     * @returns A promise that resolves when the message has been appended and saved.
     */
    async appendMessage(envelope: Envelope): Promise<void> {
        if (!envelope.convId) {
            console.warn("Attempted to append message without convId:", envelope);
            return;
        }
        const messages = await this.getMessages(envelope.convId);
        messages.push(envelope);
        localStorage.setItem(this.getKey(envelope.convId), JSON.stringify(messages));
    }

    /**
     * Retrieves all messages for a given conversation ID from `localStorage`.
     * If the conversation does not exist or if the stored data is malformed, an empty array is returned.
     * @param convId The unique identifier of the conversation.
     * @returns A promise that resolves with an array of `Envelope` objects.
     */
    async getMessages(convId: string): Promise<Envelope[]> {
        const raw = localStorage.getItem(this.getKey(convId));
        if (!raw) return [];
        try {
            return JSON.parse(raw) as Envelope[];
        } catch (error) {
            console.warn(`Failed to parse messages for convId '${convId}'. Returning empty array. Error:`, error);
            return [];
        }
    }
    /**
     * Clears all messages associated with a specific conversation from `localStorage`.
     * @param convId The unique identifier of the conversation to clear.
     * @returns A promise that resolves when the conversation's data has been removed.
     */
    async clearMessages(convId: string): Promise<void> {
        localStorage.removeItem(this.getKey(convId));
    }

    /**
     * Constructs the full `localStorage` key for a given conversation ID,
     * by prepending the configured `prefix`.
     * @private
     * @param convId The unique identifier of the conversation.
     * @returns The full `localStorage` key string.
     */
    private getKey(convId: string) {
        return `${this.prefix}${convId}`;
    }
}
