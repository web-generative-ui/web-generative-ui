import {BaseUiComponent} from "./BaseUiComponent.ts";
import type {Tabs, TransitionConfig, Component} from "../schema.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiTabs` is a custom UI component that provides a tabbed interface for displaying different content panes.
 * Users can switch between tabs, each revealing its associated content, which can consist of other UI components.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Tabs` object.
 *
 * @element ui-tabs
 * @slot (default) Renders content for the currently active tab.
 */
export class UiTabs extends BaseUiComponent {
    // The 'shadow' property is inherited from BaseUiComponent; no need to declare it here.
    // The ShadowRoot is attached and assigned to 'this.shadow' by BaseUiComponent's connectedCallback.

    /**
     * The parsed data for the tab component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private tabsData: Tabs | null = null;
    /**
     * The ID of the currently active tab. `null` if no tab is active, or data is missing.
     * @private
     */
    private activeTabIdState: string | null = null;

    /**
     * Constructs an instance of `UiTabs`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for tab content enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'tab-content-enter',
        enterActive: 'tab-content-enter-active',
        exit: 'tab-content-exit',
        exitActive: 'tab-content-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Tabs` object.
     * It validates the structure, initializes the `activeTabIdState` from `activeTab` or defaults to the first tab.
     * This method is solely responsible for data parsing, not rendering or event listener setup.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "tabs" || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
                throw new Error("Invalid tabs component data: 'component' must be 'tabs' and 'tabs' must be a non-empty array.");
            }
            this.tabsData = parsed as Tabs;

            // Use 'activeTab' (camelCase) from schema, defaulting to the first tab's ID if not specified or invalid.
            const initialActiveTabId = this.tabsData.activeTab;
            const validActiveTab = this.tabsData.tabs.find(t => t.id === initialActiveTabId);

            this.activeTabIdState = validActiveTab
                ? validActiveTab.id
                : this.tabsData.tabs[0]?.id ?? null;

        } catch (e: unknown) {
            console.error("UiTabs: Failed to parse data attribute:", e);
            this.tabsData = null; // Clear data on error
            this.activeTabIdState = null; // Clear active tab on error
        }
    }

    /**
     * Indicates whether the `tabsData` has been successfully parsed.
     * @protected
     * @returns `true` if `tabsData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.tabsData !== null;
    }

    /**
     * Extends `connectedCallback` from `BaseUiComponent` to perform initial rendering
     * and attach event listeners after the component is connected to the DOM.
     * @override
     */
    override connectedCallback(): void {
        super.connectedCallback(); // Call BaseUiComponent's connectedCallback first
        this.renderContent(); // Perform initial full render of the component's HTML structure
        this._setupListeners(); // Attach event listeners at once
        this._updateTabHeaderState(); // Apply initial active state to headers
        this._renderActiveTabContent(); // Render the content of the initially active tab
    }

    /**
     * Overrides `attributeChangedCallback` to ensure proper re-rendering when the `data` attribute changes.
     * @override
     * @param name The name of the attribute that changed.
     * @param oldValue The old value of the attribute.
     * @param newValue The new value of the attribute.
     */
    override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        // Call parent's attributeChangedCallback to handle data parsing and metadata stamping.
        super.attributeChangedCallback(name, oldValue, newValue);
        // After data is parsed and metadata updated, re-render content if 'data' changed.
        if (name === 'data' && oldValue !== newValue) {
            this.renderContent(); // Re-render the static structure and then update dynamic parts.
            this._setupListeners(); // Re-attach listeners as HTML might have changed.
            this._updateTabHeaderState();
            this._renderActiveTabContent();
        }
    }

    /**
     * **(Implemented abstract method)**
     * Renders the initial, static HTML structure of the tab component into the Shadow DOM.
     * This includes the tab headers and a single content container.
     * This method is called during initial setup and when the `data` attribute changes.
     * It **does not** handle event listener attachment or dynamic content rendering,
     * which are delegated to other private methods for efficiency.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.tabsData) {
            this.shadow.innerHTML = `<p style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Tabs data missing or invalid.</p>`;
            return;
        }

        const { tabs } = this.tabsData;
        const activeId = this.activeTabIdState;

        try {
            const allTabContentComponents: Component[] = [];
            for (const tab of tabs) {
                allTabContentComponents.push(...tab.content);
            }
            if (allTabContentComponents.length > 0) {
                this.registry.ensurePayloadComponentsDefined(allTabContentComponents).catch(e => console.warn("UiTabs: Failed to preload tab content components:", e));
            }
        } catch (e: unknown) {
            console.warn("UiTabs: Error during tab content component preloading:", e);
        }

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box;
                    width: 100%;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    ${this.tabsData.style ? formatInlineStyle(this.tabsData.style) : ''}
                    ${this.tabsData.layout ? formatLayoutMetaAsHostStyle(this.tabsData.layout) : ''}
                    /* Base transitions for host element (if any) */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                .tab-headers-container {
                    display: flex;
                    flex-wrap: wrap; /* Allow headers to wrap if many tabs */
                    border-bottom: 2px solid #e0e0e0; /* Subtle base border */
                    padding: 0 0.5em; /* Some horizontal padding for headers */
                    background-color: #f8f8f8; /* Light background for header strip */
                }
                .tab-header-btn {
                    padding: 0.75em 1.25em; /* Generous padding for click targets */
                    cursor: pointer;
                    border: none;
                    background: transparent;
                    font-weight: 500;
                    color: #555; /* Default text color */
                    white-space: nowrap; /* Prevent tab labels from wrapping */
                    transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
                    border-bottom: 2px solid transparent; /* Placeholder for active indicator */
                    text-align: center;
                }
                .tab-header-btn:hover:not(.active) {
                    color: #333;
                    background-color: #f0f0f0; /* Subtle hover background */
                }
                .tab-header-btn.active {
                    border-bottom-color: #007bff; /* Active indicator color */
                    color: #007bff; /* Active text color */
                    font-weight: 600;
                }
                .tab-content-container {
                    padding: 1em; /* Padding around the active tab's content */
                    min-height: 50px; /* Ensure content area has some height */
                    background-color: #fff;
                    border: 1px solid #e0e0e0;
                    border-top: none; /* No top border, connects to header strip */
                    border-bottom-left-radius: 8px;
                    border-bottom-right-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                    /* Transition classes from BaseUiComponent.transitionConfig for tab content */
                    /* Note: The interpreter applies these to the children rendered inside */
                    /* :host(.tab-content-enter) .tab-content-child-wrapper { opacity: 0; transform: translateY(10px); } */
                    /* :host(.tab-content-enter-active) .tab-content-child-wrapper { opacity: 1; transform: translateY(0); } */
                    /* :host(.tab-content-exit) .tab-content-child-wrapper { opacity: 1; transform: translateY(0); } */
                    /* :host(.tab-content-exit-active) .tab-content-child-wrapper { opacity: 0; transform: translateY(10px); } */
                }
                .tab-content-child-wrapper { /* Wrapper for individual components inside content */
                    display: block; /* Ensures children take up full width */
                }
            </style>
            <div class="tab-headers-container" role="tablist">
                ${tabs
            .map((t) => `
                        <button class="tab-header-btn"
                                id="tab-${t.id}"
                                role="tab"
                                aria-controls="panel-${t.id}"
                                aria-selected="${t.id === activeId}"
                                data-id="${t.id}">
                            ${t.label}
                        </button>`)
            .join("")}
            </div>
            <div id="panel-${activeId}" class="tab-content-container" role="tabpanel" aria-labelledby="tab-${activeId}"></div>
        `;
    }


    /**
     * Attaches necessary event listeners to the component's internal elements.
     * This method is called after `renderContent` to ensure elements exist.
     * It is typically called once in `connectedCallback` and again if `renderContent`
     * fully rebuilds the HTML (e.g., due to `data` attribute change).
     * @private
     */
    private _setupListeners(): void {
        // Remove existing listeners first to prevent duplicates if called multiple times
        const oldHeaderButtons = this.shadow.querySelectorAll(".tab-header-btn");
        oldHeaderButtons.forEach(btn => {
            btn.removeEventListener("click", this._handleTabClickBound);
        });

        // Add new listeners
        const headerButtons = this.shadow.querySelectorAll(".tab-header-btn");
        headerButtons.forEach((btn) => {
            btn.addEventListener("click", this._handleTabClickBound);
        });
    }

    /**
     * Memoized bound event handler to prevent re-binding issues.
     * @private
     */
    private _handleTabClickBound = this._handleTabClick.bind(this);

    /**
     * Handles a click event on a tab header, updating the active tab state and re-rendering content.
     * @private
     * @param event The click event.
     */
    private _handleTabClick(event: Event): void {
        const clickedButton = event.currentTarget as HTMLElement;
        const newActiveId = clickedButton.dataset.id;
        if (newActiveId && newActiveId !== this.activeTabIdState) {
            this.activeTabIdState = newActiveId;
            this._updateTabHeaderState(); // Update active class on headers
            this._renderActiveTabContent(); // Re-render only the active tab's content
        }
    }

    /**
     * Updates the 'active' class on tab header buttons and `aria-selected` attributes
     * to reflect the current `activeTabIdState`.
     * This method is called after `renderContent` and whenever the active tab changes.
     * @private
     */
    private _updateTabHeaderState(): void {
        const headerButtons = this.shadow.querySelectorAll(".tab-header-btn");
        headerButtons.forEach((btn) => {
            // @ts-ignore
            const tabId = btn.dataset.id;
            const isActive = tabId === this.activeTabIdState;
            btn.classList.toggle("active", isActive);
            btn.setAttribute('aria-selected', String(isActive));
        });

        // Also ensure the correct content panel has the appropriate aria attributes
        const activeContentPanel = this.shadow.querySelector(`#panel-${this.activeTabIdState}`) as HTMLElement;
        this.shadow.querySelectorAll('.tab-content-container').forEach(panel => {
            panel.setAttribute('aria-hidden', String(panel !== activeContentPanel));
        });
        if (activeContentPanel) {
            activeContentPanel.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Renders or updates the content of the currently active tab into the content container.
     * This method uses the `Interpreter` to efficiently reconcile the tab's children.
     * It is called after initial setup and whenever the active tab changes.
     * @private
     */
    private async _renderActiveTabContent(): Promise<void> {
        if (!this.hasParsedData() || !this.tabsData || !this.activeTabIdState) {
            const contentContainer = this.shadow.querySelector(".tab-content-container");
            if (contentContainer) contentContainer.innerHTML = '';
            return;
        }

        const activeTab = this.tabsData.tabs.find((t) => t.id === this.activeTabIdState);
        const contentContainer = this.shadow.querySelector(".tab-content-container") as HTMLElement;

        if (activeTab && contentContainer) {
            // Delegate rendering of the active tab's children to the Interpreter
            await this.registry.getInterpreter().render(contentContainer, activeTab.content);
        } else if (contentContainer) {
            contentContainer.innerHTML = `<p style="color: gray; padding: 1em;">No content is available for this tab.</p>`;
        }
    }
}
