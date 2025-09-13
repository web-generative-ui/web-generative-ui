import {BaseUiComponent} from "./BaseUiComponent.ts";
import type {CollapseBlock} from "../schema.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiCollapseBlock` is a custom UI component that renders a content block that can be expanded or collapsed.
 * It features a clickable header that toggles the visibility of its child components.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `CollapseBlock` object.
 *
 * @element ui-collapse-block
 * @slot (default) Renders child components passed in its `content` property.
 */
export class UiCollapseBlock extends BaseUiComponent {

    /**
     * The parsed data for the collapse block component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private blockData: CollapseBlock | null = null;
    /**
     * The current collapse state of the block. `true` means collapsed, `false` means expanded.
     * @private
     */
    private isCollapsedState: boolean = false;
    /**
     * Memoized bound event handler to prevent re-binding issues.
     * @private
     */
    private _toggleCollapseBound = this._toggleCollapse.bind(this);

    /**
     * Constructs an instance of `UiCollapseBlock`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({mode: "open"});
    }

    /**
     * Parses the JSON string from the `data` attribute into a `CollapseBlock` object.
     * It validates the structure and initializes the `isCollapsedState`.
     * This method is solely responsible for data parsing, not rendering.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "collapse-block" || !parsed.title) {
                throw new Error("Invalid collapse-block component data: 'component' must be 'collapse-block' and 'title' is required.");
            }
            this.blockData = parsed as CollapseBlock;
            this.isCollapsedState = Boolean(parsed.collapsed);
        } catch (e: unknown) {
            console.error("UiCollapseBlock: Failed to parse data attribute:", e);
            this.blockData = null;
            this.isCollapsedState = false;
        }
    }

    /**
     * Indicates whether the `blockData` has been successfully parsed.
     * @protected
     * @returns `true` if `blockData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.blockData !== null;
    }

    /**
     * Extends `connectedCallback` from `BaseUiComponent` to perform initial rendering
     * and attach event listeners after the component is connected to the DOM.
     * @override
     */
    override connectedCallback(): void {
        super.connectedCallback(); // Call BaseUiComponent's connectedCallback first
        this.renderContent(); // Initial render of the static HTML structure
        this._setupListeners(); // Attach event listeners at once
        requestAnimationFrame(() => this._updateCollapseState(false));
    }

    /**
     * Overrides `attributeChangedCallback` to ensure proper re-rendering when the `data` attribute changes.
     * @override
     * @param name The name of the attribute that changed.
     * @param oldValue The old value of the attribute.
     * @param newValue The new value of the attribute.
     */
    override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'data' && oldValue !== newValue) {
            this.renderContent(); // Re-render the static structure and content
            this._setupListeners(); // Re-attach listeners if the HTML structure was rebuilt
            requestAnimationFrame(() => this._updateCollapseState(false));
        }
    }

    /**
     * **(Implemented abstract method)**
     * Renders the initial HTML structure of the collapse block into the component's Shadow DOM.
     * It sets up the title, the content area, and delegates rendering of children
     * to the `Interpreter` **once**. Later collapse/expand state changes are handled by `_updateCollapseState`.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.blockData) {
            this.shadow.innerHTML = `<p style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Collapse-block data missing or invalid.</p>`;
            return;
        }

        const { title, content = [] } = this.blockData;
        const contentId = `${this.id || 'collapse'}-content`; // Unique ID for aria-controls

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box;
                    width: 100%;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px; /* Slightly larger radius */
                    margin: 0.75em 0;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
                    overflow: hidden; /* Crucial for max-height transition */
                    ${this.blockData.style ? formatInlineStyle(this.blockData.style) : ''}
                    ${this.blockData.layout ? formatLayoutMetaAsHostStyle(this.blockData.layout) : ''}
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out, box-shadow 0.3s;
                }
                :host(:hover) {
                    box-shadow: 0 2px 8px rgba(0,0,0,0.12); /* Subtle hover effect */
                }
                /* Transition classes for host element (defined in transition.css usually) */
                :host(.collapse-fade-enter) { opacity: 0; transform: translateY(-10px); }
                :host(.collapse-fade-enter-active) { opacity: 1; transform: translateY(0); }
                :host(.collapse-fade-exit) { opacity: 1; }
                :host(.collapse-fade-exit-active) { opacity: 0; transform: translateY(10px); }

                .header {
                    background: #f8f8f8;
                    padding: 0.75em 1em;
                    cursor: pointer;
                    font-weight: 600;
                    color: #333;
                    user-select: none;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 1.1em;
                    border-bottom: 1px solid #eee; /* Separator from content */
                    transition: background 0.2s ease;
                }
                .header:hover {
                    background: #f0f0f0;
                }
                .arrow-icon { /* Now a separate element, not pseudo */
                    display: inline-block;
                    transition: transform 0.3s ease-in-out;
                    margin-left: 0.5em;
                    font-size: 1em;
                    color: #666;
                }
                .body-wrapper {
                    overflow: hidden; /* Critical for max-height transition */
                    max-height: 0; /* Initial collapsed state (set by _updateCollapseState) */
                    opacity: 0;
                    transition: max-height 0.3s ease-out, opacity 0.3s ease-out; /* Smooth transition */
                    background-color: #fff;
                    padding: 0 1em; /* Horizontal padding always present */
                    /* Vertical padding will be dynamically managed by JS to avoid "peek" */
                }
                /* No .expanded class needed anymore; max-height and padding are set directly */
                .content-container {
                    padding-top: 1em; /* Consistent top padding for inner content */
                    padding-bottom: 1em; /* Consistent bottom padding for inner content */
                }
            </style>
            <div class="header" role="button" aria-expanded="${!this.isCollapsedState}" aria-controls="${contentId}">
                <span>${title}</span>
                <span class="arrow-icon">▶</span>
            </div>
            <div id="${contentId}" class="body-wrapper" aria-hidden="${this.isCollapsedState}">
                <div class="content-container"></div>
            </div>
        `;

        const contentContainer = this.shadow.querySelector(".content-container") as HTMLElement;
        if (contentContainer && Array.isArray(content) && content.length > 0) {
            // Render children only once during initial renderContent
            this.registry.getInterpreter().render(contentContainer, content);
        }
    }

    /**
     * Attaches necessary event listeners to the component's internal elements.
     * This method is called only once in `connectedCallback` to prevent duplicate listeners.
     * @private
     */
    private _setupListeners(): void {
        const header = this.shadow.querySelector(".header");
        if (header) {
            header.removeEventListener("click", this._toggleCollapseBound); // Remove the old one if re-rendering
            header.addEventListener("click", this._toggleCollapseBound);
        }
    }

    /**
     * Toggles the collapse state of the block and triggers a UI update.
     * @private
     */
    private _toggleCollapse(): void {
        this.isCollapsedState = !this.isCollapsedState;
        this._updateCollapseState(true); // Trigger update with animation
    }

    /**
     * Updates the UI to reflect the current `isCollapsedState`.
     * This method toggles CSS classes, adjusts `max-height` for transitions,
     * and updates ARIA attributes and the arrow indicator's rotation.
     * @private
     * @param animate If `true`, applies transitions; if `false`, updates state instantly.
     */
    private _updateCollapseState(animate: boolean = true): void {
        const header = this.shadow.querySelector(".header") as HTMLElement;
        const arrowIcon = this.shadow.querySelector(".arrow-icon") as HTMLElement;
        const bodyWrapper = this.shadow.querySelector(".body-wrapper") as HTMLElement;
        const contentContainer = this.shadow.querySelector(".content-container") as HTMLElement; // Need content container for scrollHeight

        if (!header || !arrowIcon || !bodyWrapper || !contentContainer) return;

        // Update ARIA attributes
        header.setAttribute('aria-expanded', String(!this.isCollapsedState));
        bodyWrapper.setAttribute('aria-hidden', String(this.isCollapsedState));

        // Update arrow rotation
        arrowIcon.style.transform = `rotate(${this.isCollapsedState ? "0deg" : "90deg"})`;

        // Manage max-height and padding for collapse/expand transition
        if (animate) {
            // If animating, briefly remove transition for initial `max-height` calc if needed, then re-add
            bodyWrapper.style.transition = 'none';
            bodyWrapper.style.maxHeight = 'fit-content'; // Temporarily allow getting full height
            const fullHeight = contentContainer.scrollHeight + (bodyWrapper.offsetHeight - contentContainer.offsetHeight); // Calculate wrapper's full height including its own padding/border if any
            bodyWrapper.style.maxHeight = this.isCollapsedState ? `${fullHeight}px` : '0px'; // Set to the actual current height if collapsing, or 0 if expanding
            // Force reflow
            void bodyWrapper.offsetWidth;

            bodyWrapper.style.transition = 'max-height 0.3s ease-out, opacity 0.3s ease-out';
            bodyWrapper.style.maxHeight = this.isCollapsedState ? '0px' : `${fullHeight}px`;
            bodyWrapper.style.opacity = this.isCollapsedState ? '0' : '1';

            // After transition (or timeout), if collapsed, ensure max-height is truly 0, and if expanded, set to 'none' for flexibility
            const onTransitionEnd = () => {
                bodyWrapper.removeEventListener('transitionend', onTransitionEnd);
                if (!this.isCollapsedState) {
                    bodyWrapper.style.maxHeight = 'none'; // Allow content to grow naturally after animation
                }
            };
            bodyWrapper.addEventListener('transitionend', onTransitionEnd, { once: true });

        } else {
            // No animation (initial render or data update)
            bodyWrapper.style.transition = 'none';
            bodyWrapper.style.opacity = this.isCollapsedState ? '0' : '1';

            if (this.isCollapsedState) {
                bodyWrapper.style.maxHeight = '0px';
            } else {
                bodyWrapper.style.maxHeight = 'none'; // Allow content to determine height instantly
            }
        }
    }
}
