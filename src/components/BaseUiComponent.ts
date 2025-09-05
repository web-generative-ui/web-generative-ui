import type {Registry} from "../core/Registry.ts";
import type {TransitionConfig} from "../schema.ts";

/**
 * Base class for UI components.
 */
export abstract class BaseUiComponent extends HTMLElement {
    protected abstract shadow: ShadowRoot;
    protected readonly registry: Registry;

    private static _registry: Registry | null = null;
    public static transitionConfig: Partial<TransitionConfig> = {};

    public static setRegistry(registry: Registry): void {
        BaseUiComponent._registry = registry;
    }

    protected constructor() {
        super();
        if (BaseUiComponent._registry === null) {
            throw new Error("Registry has not been set for BaseUiComponent. Call BaseUiComponent.setRegistry() first.");
        }
        this.registry = BaseUiComponent._registry;
    }

    /**
     * Define observed changes attributes
     */
    static get observedAttributes(): string[] {
        return ['data'];
    }

    /**
     * Parse the data attribute and update the component state.
     * @param data The data attribute value.
     */
    protected abstract parseData(data: string): void;

    /**
     * Render the component content.
     */
    protected abstract renderContent(): void;

    /**
     * Check if the component has parsed data.
     * @returns True if data has been parsed, false otherwise.
     */
    protected abstract hasParsedData(): boolean;

    /**
     * Called when an attribute is added, removed, or updated.
     * @param name The name of the attribute that changed.
     * @param oldValue The old value of the attribute.
     * @param newValue The new value of the attribute.
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'data' && oldValue !== newValue) {
            this.parseData(newValue || '{}');
            this.renderContent();
        }
    }

    /**
     * Called when the element is connected to the DOM.
     */
    connectedCallback(): void {
        // Only attach shadow DOM if it hasn't been done by the constructor
        if (!this.shadow && !this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
            this.shadow = this.shadowRoot!;
        }

        if (!this.hasParsedData() && this.hasAttribute('data')) {
            this.parseData(this.getAttribute('data')!);
        }
        this.renderContent();
    }
}
