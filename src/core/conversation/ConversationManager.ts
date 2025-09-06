import type {Interpreter} from "../Interpreter.ts";
import type {Transport} from "../transport/types.ts";
import type {ConversationStore} from "./ConversationStore.ts";

export class ConversationManager {
    private interpreter: Interpreter;
    private readonly rootEl: HTMLElement | ShadowRoot;
    private readonly transport?: Transport;
    private store: ConversationStore;

    constructor(interpreter: Interpreter, rootEl: HTMLElement | ShadowRoot, store: ConversationStore, transport?: Transport) {
        this.interpreter = interpreter;
        this.rootEl = rootEl;
        this.transport = transport;
        this.store = store;

        // wire transport -> manager if transport is present
        if (this.transport) {
            if (this.transport.onMessage) {
                this.transport.onMessage((env: any) => this.handleIncomingEnvelope(env).catch(console.error));
            }
            if (this.transport.onPatch) {
                this.transport.onPatch((patch: any) => this.handleIncomingEnvelope({ type: 'patch', payload: patch }).catch(console.error));
            }
            if (this.transport.onControl) {
                this.transport.onControl((c: any) => this.handleIncomingEnvelope({ type: 'control', payload: c, convId: c?.convId ?? '' }).catch(console.error));
            }
        }
    }

    async startConversation(id?: string): Promise<string> {
        return this.store.createConversation(id);
    }

    async sendUserMessage(convId: string, message: { text?: string; [k: string]: any }): Promise<void> {
        const turnId = Math.random().toString(36).substring(2, 15);
        const envelope = {
            type: 'message',
            convId,
            turnId,
            payload: {
                role: 'user',
                content: message,
            },
        };

        // append locally first
        await this.store.appendMessage(envelope);

        // send to server if transport supports send()
        if (this.transport && typeof (this.transport as any).send === 'function') {
            try {
                await (this.transport as any).send(envelope);
            } catch (err) {
                // transport send failed; still keep local append and surface error via console or onError elsewhere
                console.error('Transport.send failed', err);
                throw err;
            }
        }
    }

    async getHistory(convId: string, opts: { limit?: number; fromTurnId?: string } = {}) {
        return this.store.getHistory(convId, opts);
    }

    async handleIncomingEnvelope(envelope: any): Promise<void> {
        if (!envelope) return;

        // persist when appropriate
        try {
            await this.store.appendFromEnvelope(envelope);
        } catch (err) {
            console.error('Failed to append incoming envelope to store', err);
        }

        // route to interpreter
        try {
            if (envelope.type === 'patch') {
                if (envelope.payload) await this.interpreter.applyPatch(this.rootEl, envelope.payload);
            } else {
                // let interpreter handle other envelope types (message, control)
                await this.interpreter.handleEnvelope(this.rootEl, envelope);
            }
        } catch (err) {
            console.error('Failed to dispatch envelope to interpreter', err, envelope);
            throw err;
        }
    }
}
