import type {Registry} from "../core/Registry.ts";
import type {TransitionConfig, LayoutMeta} from "../schema.ts";
import type {ConversationStore} from "../core/conversation/ConversationStore.ts";

/**
 * Base abstract class for all custom UI components in the Generative UI library.
 *
 * This class provides foundational responsibilities for all UI components:
 * - Manages access to core services (`Registry`, `ConversationStore`).
 * - Extracts and stamps component metadata (`key`, `layout`, `type`) for reconciliation.
 * - Implements standard Web Component lifecycle methods (`connectedCallback`, `attributeChangedCallback`).
 * - Provides helpers for implementing CSS class-based enter/exit transitions.
 *
 * Subclasses must implement abstract methods to define their specific data parsing,
 * content rendering, and data parsing state.
 */
export abstract class BaseUiComponent extends HTMLElement {

    /**
     * The Shadow DOM root attached to this component. Subclasses should render their content into this `ShadowRoot`.
     * @protected
     */
    protected shadow!: ShadowRoot;
    /**
     * An instance of the `Registry` service, used for dynamically loading and defining UI components.
     * Accessible by all subclasses for rendering children.
     * @protected
     */
    protected readonly registry: Registry;
    /**
     * An instance of the `ConversationStore` service, used for managing conversation history and state.
     * Accessible by all subclasses for interacting with conversation data.
     * @protected
     */
    protected readonly store: ConversationStore;

    /**
     * Static reference to the global `Registry` instance. Set once during library initialization.
     * @private
     */
    private static _registry: Registry | null = null;
    /**
     * Static reference to the global `ConversationStore` instance. Set once during library initialization.
     * @private
     */
    private static _store: ConversationStore | null = null;

    /**
     * Per-class transition configuration. Subclasses may override this static property
     * to define custom CSS classes for entering, exit, and update animations.
     */
    public static transitionConfig: Partial<TransitionConfig> = {};

    /**
     * The raw `data` attribute string as it was last set, or an empty string.
     * Subclasses can access this for their `parseData` implementation.
     * @protected
     */
    protected rawDataString?: string;

    /**
     * The `key` property extracted from the component's `data` JSON.
     * Used by the reconciler for stable element identification.
     * @protected
     */
    protected componentKey?: string;
    /**
     * The `layout` metadata extracted from the component's `data` JSON.
     * Provides hints for how this component should be laid out by its parent container.
     * @protected
     */
    protected componentLayout?: LayoutMeta | undefined;

    /**
     * Sets the global `ConversationStore` instance, making it available to all `BaseUiComponent` instances.
     * This method should be called once during the library's initialization phase.
     * @param store The `ConversationStore` instance to set.
     */
    public static setConversationStore(store: ConversationStore): void {
        BaseUiComponent._store = store;
    }

    /**
     * Sets the global `Registry` instance, making it available to all `BaseUiComponent` instances.
     * This method should be called once during the library's initialization phase.
     * @param registry The `Registry` instance to set.
     */
    public static setRegistry(registry: Registry): void {
        BaseUiComponent._registry = registry;
    }

    /**
     * Constructs a `BaseUiComponent` instance.
     * It retrieves and assigns the globally set `Registry` and `ConversationStore` instances.
     * @throws {Error} If `Registry` or `ConversationStore` have not been set globally before instantiation.
     */
    protected constructor() {
        super();
        if (BaseUiComponent._registry === null || BaseUiComponent._store === null) {
            throw new Error("Core services (Registry, ConversationStore) have not been set for BaseUiComponent. Call BaseUiComponent.setRegistry() and BaseUiComponent.setConversationStore() first.");
        }
        this.registry = BaseUiComponent._registry;
        this.store = BaseUiComponent._store;

        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Defines which attributes the custom element should observe for changes.
     * When observed attributes change, `attributeChangedCallback` is invoked.
     * @returns An array of attribute names to observe.
     */
    static get observedAttributes(): string[] {
        return ['data'];
    }

    /**
     * Abstract method that subclasses must implement to parse their specific data from a JSON string.
     * This method should update the internal state of the component based on the parsed data.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected abstract parseData(dataString: string): void;
    /**
     * Abstract method that subclasses must implement to render their component's content.
     * This method is typically called after data parsing or when the component is connected to the DOM.
     * @protected
     */
    protected abstract renderContent(): void;
    /**
     * Abstract method that subclasses must implement to indicate if `parseData` has been successfully called.
     * Used by the base class to determine if initial data parsing is needed.
     * @protected
     * @returns `true` if data has been parsed, `false` otherwise.
     */
    protected abstract hasParsedData(): boolean;

    /**
     * Callback invoked when an observed attribute's value changes.
     * Specifically handles changes to the 'data' attribute by parsing the new data,
     * updating metadata, and re-rendering content.
     * @param name The name of the attribute that changed.
     * @param oldValue The old value of the attribute, or `null` if it was not present.
     * @param newValue The new value of the attribute, or `null` if it was removed.
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'data' && oldValue !== newValue) {
            this.rawDataString = newValue ?? '{}';
            this.parseData(this.rawDataString);
            this.updateMetadataFromDataString(this.rawDataString);
            this.renderContent();
            this.stampMetadataToHost();
        }
    }

    /**
     * Callback invoked when the custom element is first connected to the document's DOM.
     * It ensures a `ShadowRoot` exists, performs initial data parsing if needed,
     * renders the component's content, stamps metadata to the host element,
     * and applies any defined entered transitions.
     */
    connectedCallback(): void {
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });

        if (!this.hasParsedData() && this.hasAttribute('data')) {
            const dataString = this.getAttribute('data') ?? '{}';
            this.rawDataString = dataString;
            this.parseData(dataString);
            this.updateMetadataFromDataString(dataString);
        }

        this.renderContent();

        this.stampMetadataToHost();

        this.applyEnterTransition();
    }

    /**
     * Attempts to extract `key` and `layout` properties from the JSON string of the `data` attribute.
     * This method is designed to be tolerant of parsing errors and partial data.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected updateMetadataFromDataString(dataString?: string): void {
        if (!dataString) return;
        try {
            const parsed = JSON.parse(dataString);
            if (parsed?.key && typeof parsed.key === 'string') {
                this.componentKey = parsed.key;
            } else {
                this.componentKey = undefined;
            }
            if (parsed?.layout && typeof parsed.layout === 'object') {
                this.componentLayout = parsed.layout;
            } else {
                this.componentLayout = undefined;
            }
        } catch (error) {
            console.warn(`BaseUiComponent: Failed to parse metadata from data string: ${error}`);
        }
    }

    /**
     * Writes essential component metadata (type, key, layout) to the host element's `dataset`.
     * This metadata is consumed by the `Interpreter` for efficient DOM reconciliation.
     * @protected
     */
    protected stampMetadataToHost(): void {
        const host = this as HTMLElement;
        host.dataset['componentType'] = host.tagName.toLowerCase();

        if (this.componentKey) {
            host.dataset['componentKey'] = this.componentKey;
        } else {
            delete host.dataset['componentKey'];
        }

        if (this.componentLayout) {
            try {
                host.dataset['componentLayout'] = JSON.stringify(this.componentLayout);
            } catch (error) {
                console.warn(`BaseUiComponent: Failed to stringify component layout for dataset: ${error}`);
                delete host.dataset['componentLayout'];
            }
        } else {
            delete host.dataset['componentLayout'];
        }
    }

    /**
     * Applies CSS classes (defined in `static transitionConfig`) to trigger an "enter" transition
     * when the component is added to the DOM.
     * If no transition configuration is defined, this method performs no operation.
     * @protected
     */
    protected applyEnterTransition(): void {
        const Ctor = this.constructor as typeof BaseUiComponent;
        const config = Ctor.transitionConfig;
        const enterClass = config.enter;
        const enterActiveClass = config.enterActive ?? (enterClass ? `${enterClass}-active` : undefined);

        if (!enterClass) return;

        const host = this as HTMLElement;
        if (config.exit) host.classList.remove(config.exit);
        if (config.exitActive) host.classList.remove(config.exitActive);

        host.classList.add(enterClass);
        requestAnimationFrame(() => {
            if (enterActiveClass) {
                host.classList.add(enterActiveClass);
            }
            host.classList.remove(enterClass);
        });

        const onEnd = (event: TransitionEvent) => {
            if (event.target !== host) return;
            if (enterActiveClass) host.classList.remove(enterActiveClass);
            host.removeEventListener('transitionend', onEnd);
        };
        host.addEventListener('transitionend', onEnd);
    }

    /**
     * Called by the `Interpreter` (renderer) just before removing the element from the DOM so exit animation can run.
     * This method applies CSS classes (defined in `static transitionConfig`) to trigger an "exit" transition.
     * It returns a Promise that resolves when the exit transition finishes, or immediately if no transition is defined.
     * A safety timeout is included to ensure the Promise resolves even if `transitionend` doesn't fire.
     *
     * @remarks
     * This method is not called internally by `BaseUiComponent`. It is a public lifecycle hook
     * designed to be invoked externally by the `Interpreter` during its DOM reconciliation process
     * when a component is scheduled for graceful removal from the DOM.
     *
     * @public
     * @returns A Promise that resolves to `void` when the exit transition completes.
     */
    public willExit(): Promise<void> {
        const Ctor = this.constructor as typeof BaseUiComponent;
        const config = Ctor.transitionConfig;
        const exitClass = config.exit;
        const exitActiveClass = config.exitActive ?? (exitClass ? `${exitClass}-active` : undefined);

        if (!exitClass) return Promise.resolve();

        return new Promise((resolve) => {
            const host = this as HTMLElement;

            if (config.enter) host.classList.remove(config.enter);
            if (config.enterActive) host.classList.remove(config.enterActive);

            host.classList.add(exitClass);
            requestAnimationFrame(() => {
                if (exitActiveClass) {
                    host.classList.add(exitActiveClass);
                }
                host.classList.remove(exitClass);
            });

            const timeout = setTimeout(() => {
                if (exitActiveClass) host.classList.remove(exitActiveClass);
                host.removeEventListener('transitionend', onEnd);
                resolve();
            }, 1000);

            const onEnd = (event: TransitionEvent) => {
                if (event.target !== host) return;
                clearTimeout(timeout);
                if (exitActiveClass) host.classList.remove(exitActiveClass);
                host.removeEventListener('transitionend', onEnd);
                resolve();
            };

            host.addEventListener('transitionend', onEnd);
        });
    }
}
