import {BaseUiComponent} from "./BaseUiComponent.ts";
import type {Children, Component, Stream, TransitionConfig} from "../schema.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiStream` is a custom UI component designed for rendering streaming conversational items.
 * It efficiently reconciles items based on their `key` or `id`, applies per-item enter/exit
 * transitions, and renders nested component content via the `Interpreter`.
 * It supports both 'up' (newest at top) and 'down' (newest at bottom) directions for the stream.
 *
 * @element ui-stream
 * @slot (default) Renders items provided in its `items` property.
 */
export class UiStream extends BaseUiComponent {

    /**
     * The parsed data for the stream component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private streamData: Stream | null = null;

    /**
     * Constructs an instance of `UiStream`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for individual stream item enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'stream-item-enter',
        enterActive: 'stream-item-enter-active',
        exit: 'stream-item-exit',
        exitActive: 'stream-item-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Stream` object.
     * It performs validation to ensure the component type is 'stream' and `items` is an array.
     * This method is solely responsible for data parsing, not rendering.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== 'stream' || !Array.isArray(parsed.items)) {
                throw new Error("Invalid stream component data: 'component' must be 'stream' and 'items' must be an array.");
            }
            this.streamData = parsed as Stream;
        } catch (e: unknown) {
            console.error("UiStream: Failed to parse data attribute:", e);
            this.streamData = null;
        }
    }

    /**
     * Indicates whether the `streamData` has been successfully parsed.
     * @protected
     * @returns `true` if `streamData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.streamData !== null;
    }

    /**
     * Extends `connectedCallback` from `BaseUiComponent` to ensure initial rendering
     * and reconciliation of stream items after the component is connected to the DOM.
     * @override
     */
    override connectedCallback(): void {
        super.connectedCallback();
        this.renderContent();
    }

    /**
     * Overrides `attributeChangedCallback` to ensure reconciliation is triggered when data changes.
     * @override
     * @param name The name of the attribute that changed.
     * @param oldValue The old value of the attribute.
     * @param newValue The new value of the attribute.
     */
    override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'data' && oldValue !== newValue) {
            this.renderContent();
        }
    }

    /**
     * Renders the initial HTML structure of the stream into the component's Shadow DOM.
     * It sets up the main stream container and then asynchronously triggers the reconciliation
     * and rendering of individual stream items. This method should not directly update item content.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.streamData) {
            this.shadow.innerHTML = `<p style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Stream data missing or invalid.</p>`;
            return;
        }

        const { direction = 'down' } = this.streamData;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box;
                    width: 100%;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    ${this.streamData.style ? formatInlineStyle(this.streamData.style) : ''}
                    ${this.streamData.layout ? formatLayoutMetaAsHostStyle(this.streamData.layout) : ''}
                }
                .stream-container {
                    display: flex;
                    flex-direction: column; /* Default: newest at bottom */
                    gap: 1em; /* Spacing between stream items */
                    padding: 0.5em 0; /* Some padding around the stream */
                    overflow-y: auto; /* Allow scrolling if content overflows */
                    max-height: inherit; /* Inherit max-height from host if set by parent layout */
                    min-height: 50px; /* Ensure some visibility */
                    width: 100%;
                    box-sizing: border-box;
                }
                .stream-container.up {
                    flex-direction: column-reverse; /* Newest at top */
                }
                .stream-item {
                    border: 1px solid #eee; /* Subtle border */
                    border-radius: 8px;
                    padding: 0.75em 1em;
                    background: #fff;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); /* Soft shadow */
                    display: flex;
                    flex-direction: column;
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out; /* Default item transitions */
                }
                /* Stream item transition classes from BaseUiComponent.transitionConfig */
                :host(.stream-item-enter) .stream-item { opacity: 0; transform: translateY(10px); }
                :host(.stream-item-enter-active) .stream-item { opacity: 1; transform: translateY(0); }
                :host(.stream-item-exit) .stream-item { opacity: 1; transform: translateY(0); }
                :host(.stream-item-exit-active) .stream-item { opacity: 0; transform: translateY(10px); }

                .item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.8em;
                    margin-bottom: 0.5em;
                    color: #777;
                    border-bottom: 1px dashed #eee; /* Separator for header */
                    padding-bottom: 0.4em;
                }
                .item-author { font-weight: 600; color: #444; }
                .item-meta { display: flex; align-items: center; gap: 0.5em; }
                .item-timestamp { font-size: 0.9em; }
                .item-status {
                    padding: 0.2em 0.5em;
                    border-radius: 4px;
                    font-size: 0.7em;
                    font-weight: 500;
                    text-transform: uppercase;
                }
                .item-status.pending { background-color: #ffe0b2; color: #ff6f00; } /* Orange */
                .item-status.completed { background-color: #e8f5e9; color: #2e7d32; } /* Green */
                .item-status.error { background-color: #ffebee; color: #c62828; } /* Red */
                .item-content { margin-top: 0.5em; line-height: 1.5; color: #333; }
            </style>
            <div class="stream-container ${direction}"></div>
        `;

        // Asynchronously reconcile and render items
        this._reconcileStreamItems().catch(e => console.error("UiStream: Error during item reconciliation:", e));
    }

    /**
     * Asynchronously reconciles the stream's `items` with the existing DOM.
     * This method reuses existing DOM nodes where `key` or `id` matches,
     * creates new elements for new items, and gracefully removes old items.
     * It also handles preloading and rendering of nested component content.
     * @private
     */
    private async _reconcileStreamItems(): Promise<void> {
        if (!this.streamData) return;

        const streamContainer = this.shadow.querySelector('.stream-container') as HTMLElement;
        if (!streamContainer) return;

        const { items = [] } = this.streamData;

        // Preload nested component definitions used in item.content (best-effort, non-blocking)
        // This ensures components are registered before Interpreter tries to render them.
        try {
            const nestedComponents: Component[] = [];
            for (const item of items) {
                const content = item.content;
                if (content && typeof content === 'object') {
                    if (Array.isArray(content)) nestedComponents.push(...content);
                    else nestedComponents.push(content as Component);
                }
            }
            if (nestedComponents.length > 0) {
                // Do not await, let it run in the background. Handle errors silently.
                this.registry.ensurePayloadComponentsDefined(nestedComponents).catch(() => {});
            }
        } catch (e: unknown) {
            console.warn("UiStream: Failed to preload nested component definitions:", e);
        }

        // --- Reconciliation Setup ---
        const existingItemElements = Array.from(streamContainer.querySelectorAll('.stream-item')) as HTMLElement[];
        const keyedExistingElements = new Map<string, HTMLElement>();
        existingItemElements.forEach(el => {
            const key = el.dataset['streamKey'];
            if (key) keyedExistingElements.set(key, el);
        });
        const consumedElements = new Set<HTMLElement>(); // Track elements that are reused or kept

        // --- Stream Item Transition Classes ---
        const transitionConfig = (this.constructor as typeof UiStream).transitionConfig ?? {};
        const enterClass = transitionConfig.enter;
        const enterActiveClass = transitionConfig.enterActive ?? (enterClass ? `${enterClass}-active` : undefined);
        const exitClass = transitionConfig.exit;
        const exitActiveClass = transitionConfig.exitActive ?? (exitClass ? `${exitClass}-active` : undefined);

        // --- Main Reconciliation Loop ---
        const fragment = document.createDocumentFragment(); // Use a document fragment for efficient DOM manipulation

        for (let i = 0; i < items.length; i++) {
            const desiredItem = items[i];
            const itemKey = desiredItem.key ?? desiredItem.id ?? `idx-${i}`; // Fallback to an index-based key

            let elementToPlace: HTMLElement;
            let reusableElement: HTMLElement | undefined = keyedExistingElements.get(itemKey);

            // Ensure reusableElement hasn't been consumed by an earlier item with a duplicate key
            if (reusableElement && consumedElements.has(reusableElement)) {
                reusableElement = undefined;
            }

            if (reusableElement) {
                // --- Reuse existing element ---
                consumedElements.add(reusableElement);
                elementToPlace = reusableElement;
                this._updateStreamItemElement(elementToPlace, desiredItem); // Update its content

            } else {
                // --- Create new element ---
                elementToPlace = await this._createStreamItemElement(desiredItem, i); // Async due to content rendering
                // Apply to enter transition for new elements
                if (enterClass && enterActiveClass) {
                    elementToPlace.classList.add(enterClass);
                    requestAnimationFrame(() => {
                        elementToPlace.classList.add(enterActiveClass);
                        elementToPlace.classList.remove(enterClass);
                    });
                    // Cleanup after transition (best-effort)
                    const onEnd = (ev: TransitionEvent) => {
                        if (ev.target !== elementToPlace) return;
                        elementToPlace.classList.remove(enterActiveClass);
                        elementToPlace.removeEventListener('transitionend', onEnd);
                    };
                    elementToPlace.addEventListener('transitionend', onEnd);
                }
            }
            fragment.appendChild(elementToPlace); // Add to fragment
        }

        // --- Apply Fragment to DOM and Clean Up ---
        streamContainer.innerHTML = ''; // Clear existing DOM to replace with reconciled fragment
        streamContainer.appendChild(fragment);

        // Remove any leftover existing elements that were not consumed
        const removals: Promise<void>[] = [];
        for (const el of existingItemElements) {
            if (!consumedElements.has(el)) {
                removals.push(this._removeItemGracefully(el, exitClass, exitActiveClass));
            }
        }
        await Promise.all(removals); // Run removals concurrently
    }

    /**
     * Creates a new stream item HTML element based on the provided item data.
     * This also renders the item's content via the `Interpreter`.
     * @private
     * @param item The stream item data (`Stream['items'][number]`).
     * @param index The index of the item in the stream.
     * @returns A Promise that resolves with the newly created `HTMLElement` for the item.
     */
    private async _createStreamItemElement(item: Stream['items'][number], index: number): Promise<HTMLElement> {
        const itemElement = document.createElement('div');
        itemElement.className = 'stream-item';
        // Use `id` first, then `key`, then index as fallback for dataset reconciliation.
        itemElement.dataset['streamKey'] = item.key ?? item.id ?? `idx-${index}`;

        // Header structure
        const header = document.createElement('div');
        header.className = 'item-header';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'item-author';
        authorSpan.textContent = item.author ?? 'Unknown Author';

        const metaDiv = document.createElement('div');
        metaDiv.className = 'item-meta';

        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'item-timestamp';
        timestampSpan.textContent = item.timestamp ?? '';

        if (item.status) {
            const statusSpan = document.createElement('span');
            statusSpan.className = `item-status ${item.status}`;
            statusSpan.textContent = item.status;
            metaDiv.appendChild(timestampSpan);
            metaDiv.appendChild(statusSpan);
        } else {
            metaDiv.appendChild(timestampSpan);
        }

        header.appendChild(authorSpan);
        header.appendChild(metaDiv);
        itemElement.appendChild(header);

        // Content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'item-content';
        itemElement.appendChild(contentContainer);

        // Render item content
        await this._renderItemContent(contentContainer, item.content);

        return itemElement;
    }

    /**
     * Updates an existing stream item HTML element with new data.
     * This method updates the header fields and re-renders the content via the `Interpreter`.
     * @private
     * @param itemElement The existing `HTMLElement` of the stream item.
     * @param itemData The new stream item data.
     */
    private async _updateStreamItemElement(itemElement: HTMLElement, itemData: Stream['items'][number]): Promise<void> {
        // Update header fields
        const authorEl = itemElement.querySelector('.item-author') as HTMLElement | null;
        if (authorEl) authorEl.textContent = itemData.author ?? 'Unknown Author';

        const metaDiv = itemElement.querySelector('.item-meta') as HTMLElement | null;
        if (metaDiv) {
            metaDiv.innerHTML = ''; // Clear and rebuild meta-content
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'item-timestamp';
            timestampSpan.textContent = itemData.timestamp ?? '';
            metaDiv.appendChild(timestampSpan);

            if (itemData.status) {
                const statusSpan = document.createElement('span');
                statusSpan.className = `item-status ${itemData.status}`;
                statusSpan.textContent = itemData.status;
                metaDiv.appendChild(statusSpan);
            }
        }

        // Update content via interpreter (reconcile within content)
        const contentContainer = itemElement.querySelector('.item-content') as HTMLElement;
        if (contentContainer) {
            await this._renderItemContent(contentContainer, itemData.content);
        }
    }

    /**
     * Renders the content of a single stream item into its designated container.
     * Handles both plain string content and structured UI component content.
     * @private
     * @param container The `HTMLElement` where the content should be rendered.
     * @param content The content of the stream item (string or Component/Children).
     */
    private async _renderItemContent(container: HTMLElement, content: string | Component | Children): Promise<void> {
        if (typeof content === 'string') {
            container.textContent = content; // Clear and set text content
        } else if (content) { // If it's a Component or Children,
            // Ensure children are an array for the interpreter
            const contentToRender = Array.isArray(content) ? content : [content];
            // Ensure components are defined before rendering them
            try {
                await this.registry.ensurePayloadComponentsDefined(contentToRender);
            } catch (e: unknown) {
                console.error("UiStream: Failed to ensure components defined for item content:", e, content);
                // Render an error text instead
                container.textContent = `Error loading component: ${String(e)}`;
                return;
            }
            await this.registry.getInterpreter().render(container, contentToRender);
        } else {
            container.innerHTML = ''; // Clear content if it's null/undefined
        }
    }

    /**
     * Gracefully removes a stream item element from the DOM with an exit animation.
     * It applies exit transition classes and waits for the transition to complete,
     * or a safety timeout, before physically removing the element.
     * @private
     * @param element The `HTMLElement` of the stream item to remove.
     * @param exitClass The CSS class for the exit transition start.
     * @param exitActiveClass The CSS class for the active exit transition.
     * @returns A Promise that resolves when the element has been removed.
     */
    private _removeItemGracefully(element: HTMLElement, exitClass?: string, exitActiveClass?: string): Promise<void> {
        return new Promise((resolve) => {
            if (!exitClass || !exitActiveClass) {
                element.parentElement?.removeChild(element);
                return resolve();
            }

            // Remove any conflicting entered classes if present
            const transitionConfig = (this.constructor as typeof UiStream).transitionConfig ?? {};
            if (transitionConfig.enter) element.classList.remove(transitionConfig.enter);
            if (transitionConfig.enterActive) element.classList.remove(transitionConfig.enterActive);

            element.classList.add(exitClass);
            requestAnimationFrame(() => {
                element.classList.add(exitActiveClass);
                element.classList.remove(exitClass);
            });

            const timeout = setTimeout(() => {
                element.parentElement?.removeChild(element);
                resolve();
            }, 800); // Safety timeout (should be slightly longer than max CSS transition duration)

            const onEnd = (event: TransitionEvent) => {
                if (event.target !== element) return; // Ensure the event is for this element
                clearTimeout(timeout);
                element.classList.remove(exitActiveClass);
                element.removeEventListener('transitionend', onEnd);
                element.parentElement?.removeChild(element);
                resolve();
            };
            element.addEventListener('transitionend', onEnd);
        });
    }
}
