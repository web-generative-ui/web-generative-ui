import type {Interpreter} from "../Interpreter.ts";
import type {Envelope, Transport} from "../transport/types.ts";
import type {ConversationStore} from "./ConversationStore.ts";
import type {Children, Component, Patch, Text} from "../../schema.d.ts";

/**
 * Manages the lifecycle and interaction for generative UI conversations.
 * This class orchestrates communication between the UI (via Interpreter),
 * persistent storage (via ConversationStore), and a backend service (via Transport).
 * It handles sending user messages, processing incoming responses (messages, patches, controls),
 * and updating the UI accordingly.
 */
export class ConversationManager {
    /**
     * The Interpreter instance responsible for rendering and applying UI updates.
     * @private
     */
    private interpreter: Interpreter;
    /**
     * The root HTML element or Shadow DOM into which conversation UI components are rendered.
     * @private
     */
    private readonly rootElement: HTMLElement | ShadowRoot;
    /**
     * The communication transport (e.g., WebSocket, SSE) used to send and receive envelopes from a backend.
     * Optional, allowing for a UI-only conversation manager.
     * @private
     */
    private readonly transport?: Transport;
    /**
     * The ConversationStore instance responsible for managing in-memory and persistent conversation history.
     * @private
     */
    private store: ConversationStore;
    /**
     * A set of conversation IDs for which a dedicated UI container element (e.g., `UiBox`) has been created
     * and added to the `rootElement`. This is used to target UI updates to specific conversation areas.
     * @private
     */
    private activeConversationContainers: Set<string> = new Set<string>();

    /**
     * Creates an instance of `ConversationManager`.
     * Initializes the manager by connecting the Interpreter, UI root element, ConversationStore, and optional Transport.
     * If Transport is provided, it subscribes to incoming 'message', 'patch', and 'control' events.
     * @param interpreter The `Interpreter` instance for UI rendering.
     * @param rootElement The `HTMLElement` or `ShadowRoot` where UI components will be rendered.
     * @param store The `ConversationStore` instance for managing conversation history.
     * @param transport An optional `Transport` instance for backend communication.
     */
    constructor(interpreter: Interpreter, rootElement: HTMLElement | ShadowRoot, store: ConversationStore, transport?: Transport) {
        this.interpreter = interpreter;
        this.rootElement = rootElement;
        this.transport = transport;
        this.store = store;

        if (this.transport) {
            if (this.transport.onMessage) {
                this.transport.onMessage((env: any) => this.handleIncomingEnvelope(env).catch(console.error));
            }
            if (this.transport.onPatch) {
                this.transport.onPatch((patch: any) => this.handleIncomingEnvelope({
                    convId: "",
                    type: 'patch',
                    payload: patch
                }).catch(console.error));
            }
            if (this.transport.onControl) {
                this.transport.onControl((c: any) => this.handleIncomingEnvelope({
                    type: 'control',
                    payload: c,
                    convId: c?.convId ?? ''
                }).catch(console.error));
            }
        }
    }

    /**
     * Initiates a new conversation, optionally with a predefined ID.
     * This creates an entry in the `ConversationStore` but does not immediately render any UI.
     * @param id An optional unique identifier for the new conversation. If omitted, the store generates one.
     * @returns A Promise that resolves with the unique conversation ID.
     */
    async startConversation(id?: string): Promise<string> {
        return await this.store.createConversation(id);
    }

    /**
     * Clears all content from the `rootElement` of the UI.
     */
    clearContainer() {
        this.rootElement.innerHTML = '';
    }

    /**
     * Generates a simple, short, pseudo-random string ID for new message turns.
     * @private
     * @returns A unique turn ID string.
     */
    private _generateTurnId(): string {
        return Math.random().toString(36).substring(2, 15);
    }

    /**
     * Constructs and sends a user message within a specific conversation.
     * The message is first appended to the local `ConversationStore` and then,
     * if a `Transport` is configured, sent to the backend.
     * @param conversationId The ID of the conversation to which the message belongs.
     * @param userMessageContent The content of the user's message. Can be simple text or a structured object.
     * @returns A Promise that resolves when the message has been locally appended and sent (if transport exists).
     * @throws {Error} If the transport fails to send the message.
     */
    async sendMessage(conversationId: string, userMessageContent: { text?: string; [k: string]: any }): Promise<void> {
        const messageTurnId = this._generateTurnId();
        const outgoingEnvelope: Envelope = {
            type: 'message',
            convId: conversationId,
            turnId: messageTurnId,
            payload: {
                role: 'user',
                content: userMessageContent,
            },
        };

        await this.store.appendMessage(outgoingEnvelope);

        if (this.transport && typeof this.transport.send === 'function') {
            try {
                await this.transport.send(outgoingEnvelope);
            } catch (err) {
                console.error('ConversationManager: Transport.send failed for outgoing message:', err, outgoingEnvelope);
                throw err;
            }
        } else if (this.transport) {
            console.warn("ConversationManager: Transport provided but does not implement 'send' method.");
        } else {
            console.log("ConversationManager: No transport configured. Message only appended locally.");
        }
    }

    /**
     * Retrieves messages for a given conversation from the `ConversationStore`.
     * Supports optional limiting and filtering by `turnId`.
     * @param conversationId The ID of the conversation to retrieve messages from.
     * @param options Filtering and pagination options:
     *   `limit`: Optional. The maximum number of messages to return (from the end of the history).
     *   `fromTurnId`: Optional. If provided, messages are returned starting from the message with this `turnId` (inclusive).
     * @returns A Promise that resolves with an array of `Envelope` objects representing the conversation history.
     */
    async getMessages(conversationId: string, options: { limit?: number; fromTurnId?: string } = {}) {
        return this.store.getHistory(conversationId, options);
    }

    /**
     * Generates a unique HTML `id` for a conversation's UI container.
     * @private
     * @param conversationId The unique ID of the conversation.
     * @returns The HTML ID for the conversation's container element.
     */
    private _getConversationContainerId(conversationId: string): string {
        return `conv-${conversationId}`;
    }

    /**
     * Persists a derived `Envelope` (typically a 'patch' envelope generated internally)
     * to the `ConversationStore`.
     * @private
     * @param envelopeToPersist The derived `Envelope` to save.
     * @param context A descriptive string for logging purposes.
     */
    private async _persistDerivedEnvelope(envelopeToPersist: Envelope, context: string): Promise<void> {
        try {
            await this.store.appendFromEnvelope(envelopeToPersist);
        } catch (err) {
            console.error(`ConversationManager: Failed to persist derived envelope (${context})`, err, envelopeToPersist);
        }
    }

    /**
     * Converts a plain `message` type `Envelope` into a `patch` type `Envelope`
     * that the `Interpreter` can process to update the UI.
     * It intelligently checks if the message payload already contains a UI schema;
     * otherwise, it wraps plain text content in a 'text' component.
     * @private
     * @param incomingMessageEnvelope The incoming 'message' type `Envelope` to convert.
     * @returns A new `Envelope` of a type 'patch' containing the derived UI `Patch`.
     */
    private _convertMessageToPatchEnvelope(incomingMessageEnvelope: Envelope): Envelope {
        const conversationId = incomingMessageEnvelope.convId ?? `conv-${Date.now()}`; // Fallback ID for consistency
        const role = incomingMessageEnvelope.payload?.role ?? incomingMessageEnvelope.payload?.content?.role ?? 'assistant';
        const messageRawContent = incomingMessageEnvelope.payload?.content;
        let patchValue: Component | Children;

        // If payload.content already looks like a UI schema (has .component), use it as-is
        if (messageRawContent && typeof messageRawContent === 'object' && 'component' in messageRawContent) {
            patchValue = { ...messageRawContent as Component };
        } else {
            // Otherwise, render plain text via a 'text' component
            const textContent = typeof messageRawContent === 'string'
                ? messageRawContent
                : messageRawContent?.text ?? String(messageRawContent ?? '');
            patchValue = {
                component: 'text',
                id: `text-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`, // Unique ID
                text: textContent,
                meta: { role, convId: conversationId },
            } as Text;
        }

        // Determine the target path for the patch: conversation container if active, otherwise null (root)
        const path = this.activeConversationContainers.has(conversationId)
            ? this._getConversationContainerId(conversationId)
            : null;

        const generatedPatch: Patch = {
            op: 'add',
            path,
            value: patchValue,
        };

        return {
            type: 'patch',
            convId: conversationId,
            payload: generatedPatch,
        };
    }

    /**
     * Handles the processing of an incoming 'control' type envelope.
     * Specifically manages the creation of a UI container for a conversation when a 'conversation_started'
     * event is received.
     * @private
     * @param incomingControlEnvelope The incoming 'control' type `Envelope`.
     * @returns A Promise that resolves after the control event is handled and UI updated.
     */
    private async _handleControlEnvelope(incomingControlEnvelope: Envelope): Promise<void> {
        const conversationId = incomingControlEnvelope.convId ?? `conv-${Date.now()}`;
        const event = incomingControlEnvelope.payload?.event;

        if (event === 'conversation_started') {
            const containerId = this._getConversationContainerId(conversationId);

            if (!this.activeConversationContainers.has(conversationId)) {
                const createConvPatch: Patch = {
                    op: 'add',
                    path: null, // Add to a root element
                    value: {
                        component: 'box', // Use a 'box' component as the container
                        id: containerId,
                    } as Component, // Explicitly type as Component
                };

                const patchEnvelope: Envelope = { type: 'patch', convId: conversationId, payload: createConvPatch };

                await this._persistDerivedEnvelope(patchEnvelope, 'conversation_started container patch');
                await this.interpreter.applyPatch(this.rootElement, createConvPatch);
                this.activeConversationContainers.add(conversationId);
                console.log(`ConversationManager: Created container '${containerId}' for conversation '${conversationId}'.`);
            }
        }

        // Forward control envelopes to the interpreter for other potential control actions
        await this.interpreter.handleEnvelope(this.rootElement, incomingControlEnvelope);
    }

    /**
     * Handles the processing of an incoming 'message' type envelope.
     * Converts the message content into a UI patch (either structured component or text)
     * and applies it to the UI via the `Interpreter`.
     * @private
     * @param incomingMessageEnvelope The incoming 'message' type `Envelope`.
     * @returns A Promise that resolves after the message is processed and UI updated.
     */
    private async _handleMessageEnvelope(incomingMessageEnvelope: Envelope): Promise<void> {
        const conversationId = incomingMessageEnvelope.convId ?? `conv-${Date.now()}`;
        const incomingMessageContent = incomingMessageEnvelope.payload?.content;

        // Determine if the message content already represents a UI schema component
        const isSchemaComponent = !!(incomingMessageContent && typeof incomingMessageContent === 'object' && 'component' in incomingMessageContent);

        if (isSchemaComponent) {
            // If it's a schema component, convert it directly into an 'add' patch
            const targetPath = this.activeConversationContainers.has(conversationId)
                ? this._getConversationContainerId(conversationId)
                : null;

            const derivedSchemaPatch: Patch = {
                op: 'add',
                path: targetPath,
                value: { ...(incomingMessageContent as Component) }, // Use content as the patch value
            };

            const patchEnvelope: Envelope = { type: 'patch', convId: conversationId, payload: derivedSchemaPatch };
            await this._persistDerivedEnvelope(patchEnvelope, 'derived schema message patch');
            await this.interpreter.applyPatch(this.rootElement, derivedSchemaPatch);
        } else {
            // Otherwise, convert the plain text/simple message into a 'text' component patch
            const derivedMessageAsPatchEnvelope = this._convertMessageToPatchEnvelope(incomingMessageEnvelope);
            await this._persistDerivedEnvelope(derivedMessageAsPatchEnvelope, 'derived text message patch');
            await this.interpreter.applyPatch(this.rootElement, derivedMessageAsPatchEnvelope.payload as Patch);
        }
    }

    /**
     * Central routing mechanism for all incoming `Envelope`s from the `Transport`.
     * It persists the original envelope, then processes it based on its type:
     * - 'patch': Applies directly to the UI via the `Interpreter`.
     * - 'control': Handles lifecycle events like 'conversation_started' (creating UI containers).
     * - 'message': Converts plain messages into UI patches (either structured components or text components)
     *   and then applies them via the `Interpreter`.
     * If the envelope type is not explicitly handled, it falls back to the `Interpreter`'s `handleEnvelope`.
     * @param incomingEnvelope The `Envelope` received from the transport layer.
     * @returns A Promise that resolves when the envelope has been processed and UI updated.
     * @private
     */
    async handleIncomingEnvelope(incomingEnvelope: Envelope): Promise<void> {
        if (!incomingEnvelope) {
            console.warn("ConversationManager: Received empty or undefined incoming envelope.");
            return;
        }

        await this._persistDerivedEnvelope(incomingEnvelope, 'original incoming envelope');

        try {
            switch (incomingEnvelope.type) {
                case 'patch':
                    if (incomingEnvelope.payload) {
                        await this.interpreter.applyPatch(this.rootElement, incomingEnvelope.payload as Patch);
                    }
                    break;
                case 'control':
                    await this._handleControlEnvelope(incomingEnvelope);
                    break;
                case 'message':
                    await this._handleMessageEnvelope(incomingEnvelope);
                    break;
                default:
                    // Fallback: Let the interpreter handle any other unrecognized envelope types for compatibility
                    console.warn(`ConversationManager: Unknown or unhandled envelope type '${incomingEnvelope.type}'. Forwarding to interpreter.`, incomingEnvelope);
                    await this.interpreter.handleEnvelope(this.rootElement, incomingEnvelope);
            }
        } catch (err) {
            console.error('ConversationManager: Failed to dispatch incoming envelope to interpreter:', err, incomingEnvelope);
            throw err;
        }
    }
}
