import type {Envelope} from "../transport/types.ts";

export interface PersistenceStrategy {
    createConversation(convId: string): Promise<void>;
    appendMessage(envelope: Envelope): Promise<void>;
    getMessages(convId: string): Promise<Envelope[]>;
    clearMessages(convId: string): Promise<void>;
}

export class ConversationStore {
    private memoryStore: Map<string, Envelope[]>;
    private readonly persistence?: PersistenceStrategy;

    constructor(persistence?: PersistenceStrategy) {
        this.memoryStore = new Map();
        this.persistence = persistence;
    }

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

    async appendMessage(envelope: any): Promise<void> {
        const convId = envelope?.convId;
        if (!convId) return;

        if (!this.memoryStore.has(convId)) {
            await this.createConversation(convId);
        }

        const messages = this.memoryStore.get(convId)!;
        messages.push(envelope);

        if (this.persistence) {
            await this.persistence.appendMessage(envelope);
        }
    }

    async appendFromEnvelope(envelope: any): Promise<void> {
        if (envelope?.type !== 'message' || !envelope?.convId) {
            return;
        }

        await this.appendMessage(envelope);
    }

    async getHistory(convId: string, opts: { limit?: number; fromTurnId?: string } = {}): Promise<any[]> {
        let messages: any[] = [];

        if (this.memoryStore.has(convId)) {
            messages = this.memoryStore.get(convId)!;
        } else if (this.persistence) {
            messages = await this.persistence.getMessages(convId);
            this.memoryStore.set(convId, messages);
        }

        if (opts.fromTurnId) {
            const index = messages.findIndex(envelope => envelope?.turnId === opts.fromTurnId);
            messages = index >= 0 ? messages.slice(index) : [];
        }

        if (opts.limit) {
            messages = messages.slice(-opts.limit);
        }

        return messages;
    }

    async clear(convId: string): Promise<void> {
        this.memoryStore.delete(convId);

        if (this.persistence) {
            await this.persistence.clearMessages(convId);
        }
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}
