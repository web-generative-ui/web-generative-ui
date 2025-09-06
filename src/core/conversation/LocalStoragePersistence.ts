import type {PersistenceStrategy} from "./ConversationStore.ts";

export class LocalStoragePersistence implements PersistenceStrategy{
    private prefix: string;

    constructor(prefix = 'generativeui:conv:') {
        this.prefix = prefix;
    }

    async createConversation(convId: string): Promise<void> {
        if (!this.getKey(convId)) {
            localStorage.setItem(this.getKey(convId), JSON.stringify([]));
        }
    }

    async appendMessage(envelope: any): Promise<void> {
        const convId = envelope?.convId;
        if (!convId) return;
        const messages = await this.getMessages(convId);
        messages.push(envelope);
        localStorage.setItem(this.getKey(convId), JSON.stringify(messages));
    }

    async getMessages(convId: string): Promise<any[]> {
        const raw = localStorage.getItem(this.getKey(convId));
        if (!raw) return [];
        try {
            return JSON.parse(raw) as any[];
        } catch {
            return [];
        }
    }

    async clearMessages(convId: string): Promise<void> {
        localStorage.removeItem(this.getKey(convId));
    }

    private getKey(convId: string) {
        return `${this.prefix}${convId}`;
    }
}
