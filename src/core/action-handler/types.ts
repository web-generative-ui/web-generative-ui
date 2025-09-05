import type { Action, Patch } from '../../schema';

export interface ActionContext {
    /** The action object dispatched by the UI component. */
    action: Action;
    /** The full history of UI patches for the current conversation. */
    history: Patch[];
    /** A function to send an action back to the backend. */
    sendToBackend: (action: Action, history: Patch[]) => Promise<void>;
    /** A reference to the main app root element, if needed for direct DOM manipulation. */
    appRoot: HTMLElement;
}

/**
 * Defines the contract for an action handler.
 */
export interface ActionHandler {
    /** The type of action this handler is responsible for (e.g., 'show_details''). */
    type: string;
    /** The function that executes when the action is dispatched. */
    handle: (context: ActionContext) => Promise<void>;
}
