import type {TransportEvent, Transport, SSETransportOptions} from './types.ts';
import {DEFAULT_RECONNECT_POLICY} from './types.ts'
import type {Envelope} from "./types.ts";

export class SSETransport implements Transport{
    public error?: string;
    public isConnected = false;
    public options: SSETransportOptions;

    private eventSource: EventSource | null = null;
    private eventCallbacks: Set<(event: TransportEvent) => void> = new Set();
    // private reconnectAttempts = 0;
    private reconnectTimer: any = null;
    private pendingMessages: Envelope[] = [];

    constructor(options: SSETransportOptions) {
        this.options = {
            ...options,
            reconnectPolicy: DEFAULT_RECONNECT_POLICY,
            withCredentials: false,
            streamURL: options.streamURL,
            sendURL: options.sendURL
        };
    }

    async send(envelope: Envelope): Promise<void> {
        if (!this.isConnected) {
            // Store message for when connection is established
            this.pendingMessages.push(envelope);

            if (!this.eventSource) {
                await this.open();
            }
            return;
        }

        try {
            if (!this.options.sendURL) {
                throw new Error('SSE URL is not configured');
            }
            const response = await fetch(this.options.sendURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.options.headers
                },
                body: JSON.stringify(envelope),
                credentials: this.options.withCredentials ? 'include' : 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error: any) {
            this.emitEvent({
                type: 'error',
                error: `Failed to send message: ${error.message}`
            });
            throw error;
        }
    }

    async open(): Promise<void> {
        if (this.eventSource) {
            this.close();
        }

        try {
            if (!this.options.streamURL) {
                throw new Error('SSE URL is not configured');
            }
            this.eventSource = new EventSource(this.options.streamURL, {
                withCredentials: this.options.withCredentials
            });

            this.setupEventSourceHandlers();

            // Wait for connection to open
            await new Promise<void>((resolve, reject) => {
                const onOpen = () => {
                    this.eventSource?.removeEventListener('open', onOpen);
                    resolve();
                };

                const onError = () => {
                    this.eventSource?.removeEventListener('error', onError);
                    reject(new Error('Failed to connect to SSE endpoint'));
                };

                if(!this.eventSource){
                    reject(new Error('Failed to connect to SSE endpoint'));
                    return;
                }
                this.eventSource.addEventListener('open', onOpen);
                this.eventSource.addEventListener('error', onError);

                setTimeout(() => {
                    this.eventSource?.removeEventListener('open', onOpen);
                    this.eventSource?.removeEventListener('error', onError);
                    reject(new Error('Connection timeout'));
                }, 10000);
            });

            this.isConnected = true;
            // this.reconnectAttempts = 0;
            this.emitEvent({ type: 'open' });

            while (this.pendingMessages.length > 0) {
                const message = this.pendingMessages.shift();
                if (message) {
                    await this.send(message);
                }
            }
        } catch (error: any) {
            this.emitEvent({
                type: 'error',
                error: `Failed to open connection: ${error.message}`
            });
            this.handleDisconnection();
            throw error;
        }
    }

    close(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        this.isConnected = false;
        this.emitEvent({ type: 'close' });
    }

    onEvent(callback: (event: TransportEvent) => void): void {
        this.eventCallbacks.add(callback);
    }

    offEvent(callback: (event: TransportEvent) => void): void {
        this.eventCallbacks.delete(callback);
    }

    onMessage(callback: (envelope: Envelope) => void): void {
        this.onEvent((event) => {
            if (event.type === 'message') {
                callback(event.envelope);
            }
        });
    }

    onPatch(callback: (patch: any) => void): void {
        this.onEvent((event) => {
            if (event.type === 'patch') {
                callback(event.envelope.payload);
            }
        });
    }

    onControl(callback: (control: any) => void): void {
        this.onEvent((event) => {
            if (event.type === 'control') {
                callback(event.envelope.payload);
            }
        });
    }

    onOpen(callback: () => void): void {
        this.onEvent((event) => {
            if (event.type === 'open') {
                callback();
            }
        });
    }

    onClose(callback: () => void): void {
        this.onEvent((event) => {
            if (event.type === 'close') {
                callback();
            }
        });
    }

    onError(callback: (error: string) => void): void {
        this.onEvent((event) => {
            if (event.type === 'error') {
                callback(event.error);
            }
        });
    }

    onDisconnect(callback: () => void): void {
        this.onEvent((event) => {
            if (event.type === 'disconnect') {
                callback();
            }
        });
    }

    onReconnect(callback: () => void): void {
        this.onEvent((event) => {
            if (event.type === 'reconnect') {
                callback();
            }
        });
    }

    private setupEventSourceHandlers(): void {
        if (!this.eventSource) return;

        this.eventSource.onmessage = (event) => {
            try {
                const envelope: Envelope = JSON.parse(event.data);

                // Emit event based on envelope type
                this.emitEvent({
                    type: envelope.type as 'message' | 'patch' | 'control',
                    envelope
                });
            } catch (error: any) {
                this.emitEvent({
                    type: 'error',
                    error: `Failed to parse message: ${error.message}`
                });
            }
        };

        this.eventSource.onerror = (_) => {
            this.emitEvent({
                type: 'error',
                error: 'SSE connection error'
            });
            this.handleDisconnection();
        };

        this.eventSource.addEventListener('open', () => {
            this.isConnected = true;
            // this.reconnectAttempts = 0;
            this.emitEvent({ type: 'open' });
        });

        // Handle server-sent close events
        this.eventSource.addEventListener('close', () => {
            this.close();
        });
    }

    private emitEvent(event: TransportEvent): void {
        for (const callback of this.eventCallbacks) {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in transport event callback:', error);
            }
        }
    }

    private handleDisconnection(): void {
        this.isConnected = false;
        this.emitEvent({ type: 'disconnect' });

        this.close();

        this.emitEvent({
            type: 'error',
            error: 'Connection closed'
        });
    }
}
