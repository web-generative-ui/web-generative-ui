import type { Action, Patch } from '../../schema';
import type { ActionHandler, ActionContext } from './types';

/**
 * The ActionDispatcher class is responsible for dispatching actions to the appropriate action handlers.
 * It provides a centralized mechanism for handling and dispatching user interactions.
 */
export class ActionDispatcher {
    private handlers = new Map<string, ActionHandler['handle']>();
    private readonly appRoot: HTMLElement;

    constructor(appRoot: HTMLElement, defaultHandler: ActionHandler['handle'] = async () => {}) {
        this.appRoot = appRoot;
        this.registerHandler({ type: 'default', handle: defaultHandler });
    }

    /**
     * Registers a new action handler.
     * @param handler An object conforming to the ActionHandler interface.
     */
    public registerHandler(handler: ActionHandler): void {
        if (this.handlers.has(handler.type)) {
            console.warn(`Action handler for type '${handler.type}' already registered. Overwriting.`);
        }
        this.handlers.set(handler.type, handler.handle);
    }

    /**
     * Dispatches an action to the appropriate registered handler.
     * @param action The action object.
     * @param history The full conversation history.
     */
    public async dispatch(action: Action, history: Patch[]): Promise<void> {
        // --- HATEOAS PATH ---
        if (action.href) {
            console.log(`Dispatching HATEOAS action: ${action.method || 'POST'} to ${action.href}`);
            try {
                // The 'sendToBackend' function now needs to be more generic
                await this.sendHttpRequest(action.href, action.method || 'POST', action.payload);
                // After this request, we expect the backend to start a new SSE stream
            } catch (error) {
                console.error(`Error handling HATEOAS action for href '${action.href}':`, error);
            }
            return;
        }

        // --- CLIENT-SIDE HANDLER PATH ---
        if (action.type) {
            const handler = this.handlers.get(action.type);
            if (handler) {
                console.log(`Dispatching client-side action type '${action.type}' to handler.`);
                const context: ActionContext = {
                    action,
                    history,
                    // 'sendToBackend' is now more for when a client-side handler needs to escalate to the server
                    sendToBackend: (escalatedAction, currentHistory) => this.sendHttpRequest('/api/user-action', 'POST', { action: escalatedAction, history: currentHistory }),
                    appRoot: this.appRoot,
                };
                try {
                    await handler(context);
                } catch (error) {
                    console.error(`Error handling action '${action.type}':`, error);
                }
            } else {
                console.warn(`No client-side handler for action type: '${action.type}'. Doing nothing.`);
            }
            return;
        }

        console.error("Received an invalid action with no 'href' or 'type'.", action);
    }

    private async sendHttpRequest(url: string, method: string, body?: any): Promise<void> {
        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        // ... handle response ...
    }
}
