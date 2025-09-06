export type Envelope = {
    type: 'patch' | 'message' | 'control';
    seq?: number;                 // optional sequence for ordering/ack
    convId: string;
    turnId?: string;
    role?: 'assistant'|'user'|'system';
    timestamp?: string;
    modelContext?: Record<string, any>; // model-specific metadata
    payload: any;
}

export interface ReconnectPolicy {
    maxAttempts: number;
    initialDelay: number;
    backoffFactor: number;
    maxDelay: number;
    jitter: boolean;
}

// Base for the transport options. The 'type' is the discriminant.
export interface TransportOptionsBase {
    url: string;
    reconnectPolicy?: ReconnectPolicy;
}

// Specific transport options interfaces, each with a unique 'type' literal.
export interface SSETransportOptions extends TransportOptionsBase {
    type: 'sse';
    withCredentials?: boolean;
    headers?: Record<string, string>;
}

export interface WebSocketTransportOptions extends TransportOptionsBase {
    type: 'websocket';
    heartbeatInterval?: number;
    timeout?: number;
}

// The union type of all valid transport options.
export type TransportOptions = SSETransportOptions | WebSocketTransportOptions;

export interface Transport {
    error?: string;
    isConnected: boolean;
    options: TransportOptions;

    // Core methods
    send(envelope: Envelope): Promise<void>;
    open(): Promise<void>;
    close(): void;

    // Event listeners
    onEvent(callback: (event: TransportEvent) => void): void;
    offEvent(callback: (event: TransportEvent) => void): void;

    // Specific event shortcuts
    onMessage(callback: (envelope: Envelope) => void): void;
    onPatch(callback: (patch: any) => void): void;
    onControl(callback: (control: any) => void): void;
    onOpen(callback: () => void): void;
    onClose(callback: () => void): void;
    onError(callback: (error: string) => void): void;
    onDisconnect(callback: () => void): void;
    onReconnect(callback: () => void): void;
}

// Default reconnect policy
export const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
    maxAttempts: 10,
    initialDelay: 1000,
    backoffFactor: 1.5,
    maxDelay: 30000,
    jitter: true
};

// Transport Event Shapes
interface TransportMessageEvent {
    type: 'message';
    envelope: Envelope;
}

interface TransportPatchEvent {
    type: 'patch';
    envelope: Envelope;
}

interface TransportControlEvent {
    type: 'control';
    envelope: Envelope;
}

interface TransportOpenEvent {
    type: 'open';
}

interface TransportCloseEvent {
    type: 'close';
}

interface TransportErrorEvent {
    type: 'error';
    error: string;
    code?: number;
}

interface TransportDisconnectEvent {
    type: 'disconnect';
    reason?: string;
}

interface TransportReconnectEvent {
    type: 'reconnect';
    attempt: number;
}

export type TransportEvent =
    | TransportMessageEvent
    | TransportPatchEvent
    | TransportControlEvent
    | TransportOpenEvent
    | TransportCloseEvent
    | TransportErrorEvent
    | TransportDisconnectEvent
    | TransportReconnectEvent;
