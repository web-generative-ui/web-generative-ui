import type {Interpreter} from "../Interpreter.ts";
import type {Transport} from "../transport/types.ts";
import type {ConversationStore} from "./ConversationStore.ts";
import type {Patch} from "../../schema.ts";

export class ConversationManager {
    private interpreter: Interpreter;
    private readonly rootEl: HTMLElement | ShadowRoot;
    private readonly transport?: Transport;
    private store: ConversationStore;
    private convContainers: Set<string> = new Set<string>();

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

    /**
     * Ensure there is a conversation in the store and create a UI container for it.
     * Returns the convId.
     */
    async startConversation(id?: string): Promise<string> {
        return await this.store.createConversation(id);
    }

    async sendMessage(convId: string, message: { text?: string; [k: string]: any }): Promise<void> {
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

    async getMessages(convId: string, opts: { limit?: number; fromTurnId?: string } = {}) {
        return this.store.getHistory(convId, opts);
    }

    /**
     * Central routing for incoming envelopes.
     * - Accepts envelopes of type 'patch' | 'message' | 'control'
     * - Converts plain message envelopes to patch envelopes that the Interpreter can render
     * - Persists both original and derived envelopes via store.appendFromEnvelope
     */
    async handleIncomingEnvelope(envelope: any): Promise<void> {
        if (!envelope) return;

        // persist the original envelope when appropriate
        try {
            await this.store.appendFromEnvelope(envelope);
        } catch (err) {
            console.error('Failed to append incoming envelope to store', err);
        }

        // helper: get or create conversation container id
        const getConvContainerId = (convId: string) => `conv-${convId}`;

        // helper: convert a plain message envelope (string or simple object) to a Patch envelope
        const messageToPatchEnvelope = (env: any) => {
            const convId = env.convId ?? `conv-${Date.now()}`;
            const role = env.payload?.role ?? env.payload?.content?.role ?? 'assistant';
            const rawContent = env.payload?.content;
            let value: any;

            // If payload.content already looks like a UI schema (has .component), use it as-is
            if (rawContent && typeof rawContent === 'object' && rawContent.component) {
                value = { ...rawContent };
            } else {
                // Otherwise render plain text via a text component
                const text =
                    typeof rawContent === 'string'
                        ? rawContent
                        : rawContent?.text ?? String(rawContent ?? '');
                value = {
                    component: 'text',
                    id: `text-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
                    text,
                    meta: { role, convId },
                };
            }

            // Put the derived patch into the per-conversation container if present
            const path = this.convContainers.has(convId) ? getConvContainerId(convId) : null;

            const patch: Patch = {
                op: 'add',
                path,
                value,
            };

            return {
                type: 'patch',
                convId,
                payload: patch,
            };
        };

        try {
            // ----- PATCH: apply directly -----
            if (envelope.type === 'patch') {
                if (envelope.payload) {
                    await this.interpreter.applyPatch(this.rootEl, envelope.payload);
                }
                return;
            }

            // ----- CONTROL: handle lifecycle events -----
            if (envelope.type === 'control') {
                const convId = envelope.convId ?? `conv-${Date.now()}`;
                const event = envelope.payload?.event;

                // conversation started -> create a per-conversation container (box)
                if (event === 'conversation_started') {
                    const containerId = getConvContainerId(convId);

                    // avoid duplicate creation
                    if (!this.convContainers.has(convId)) {
                        const createConvPatch: Patch = {
                            op: 'add',
                            path: null,
                            value: {
                                component: 'box',
                                id: containerId,
                            },
                        };

                        const patchEnvelope = { type: 'patch', convId, payload: createConvPatch };

                        // persist derived patch
                        try {
                            await this.store.appendFromEnvelope(patchEnvelope);
                        } catch (err) {
                            console.error('Failed to persist conv container patch', err);
                        }

                        // apply the patch to create the container
                        await this.interpreter.applyPatch(this.rootEl, createConvPatch);

                        // track container so subsequent patches use path = containerId
                        this.convContainers.add(convId);
                    }
                }

                // other control events may be forwarded to interpreter if needed
                await this.interpreter.handleEnvelope(this.rootEl, envelope);
                return;
            }

            // ----- MESSAGE: convert or forward -----
            if (envelope.type === 'message') {
                const convId = envelope.convId ?? `conv-${Date.now()}`;

                // If message.payload.content already contains a UI schema, convert to patch and apply.
                const content = envelope.payload?.content;
                const containsSchema = !!(content && typeof content === 'object' && content.component);

                if (containsSchema) {
                    // convert schema into a patch so Interpreter.applyPatch is always used
                    const schemaPatch: Patch = {
                        op: 'add',
                        path: this.convContainers.has(convId) ? getConvContainerId(convId) : null,
                        value: { ...content },
                    };

                    const patchEnvelope = { type: 'patch', convId, payload: schemaPatch };

                    try {
                        await this.store.appendFromEnvelope(patchEnvelope);
                    } catch (err) {
                        console.error('Failed to persist derived schema patch', err);
                    }

                    await this.interpreter.applyPatch(this.rootEl, schemaPatch);
                    return;
                }

                // Otherwise convert plain-text or simple message into a text patch
                const derivedPatchEnv = messageToPatchEnvelope(envelope);

                try {
                    await this.store.appendFromEnvelope(derivedPatchEnv);
                } catch (err) {
                    console.error('Failed to persist derived message->patch envelope', err);
                }

                await this.interpreter.applyPatch(this.rootEl, derivedPatchEnv.payload);
                return;
            }

            // ----- Fallback: let interpreter handle anything else (for compatibility) -----
            await this.interpreter.handleEnvelope(this.rootEl, envelope);
        } catch (err) {
            console.error('Failed to dispatch envelope to interpreter', err, envelope);
            throw err;
        }
    }
}
