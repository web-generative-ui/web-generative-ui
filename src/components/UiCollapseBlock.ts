import {BaseUiComponent} from "./BaseUiComponent.ts";
import type {CollapseBlock} from "../schema.ts";

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
    private isCollapsed: boolean = false;

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
            this.isCollapsed = Boolean(parsed.collapsed);
        } catch (e: unknown) {
            console.error("UiCollapseBlock: Failed to parse data attribute:", e);
            this.blockData = null;
            this.isCollapsed = false;
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
     * Renders the initial HTML structure of the collapse block into the component's Shadow DOM.
     * It sets up the title and the content area, and then delegates rendering of children
     * to the `Interpreter` **once**. State changes (collapsed/expanded) are handled by `_updateCollapseState`.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color: red;">Invalid or missing collapse-block data</span>`;
            return;
        }

        const { title } = this.blockData!;

        this.shadow.innerHTML = `
        <style>
            :host {
                display: block;
                border: 1px solid #ddd;
                border-radius: 6px;
                margin: 0.75em 0;
                font-family: sans-serif;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                overflow: hidden;
                transition: box-shadow 0.3s;
            }
            :host(:hover) {
                box-shadow: 0 2px 6px rgba(0,0,0,0.12);
            }
            .header {
                background: #f9f9f9;
                padding: 0.75em 1em;
                cursor: pointer;
                font-weight: 600;
                user-select: none;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 14px;
                transition: background 0.2s;
            }
            .header:hover {
                background: #f0f0f0;
            }
            .header::after {
                content: "›";
                display: inline-block;
                transform: rotate(${this.isCollapsed ? "0" : "90deg"});
                transition: transform 0.3s ease;
                font-size: 1rem;
                margin-left: 0.5em;
                color: #666;
            }
            .body {
                overflow: hidden;
                max-height: 0;
                opacity: 0;
                transition: max-height 300ms ease, opacity 200ms ease;
                background: #fff;
                padding: 0 1em;
            }
            .body.expanded {
                opacity: 1;
                padding: 0.75em 1em;
            }
        </style>
        <div class="header">${title}</div>
        <div class="body ${this.isCollapsed ? "" : "expanded"}"></div>
    `;

        const header = this.shadow.querySelector(".header");
        const body = this.shadow.querySelector(".body") as HTMLElement;

        const updateBodyHeight = () => {
            body.style.maxHeight = this.isCollapsed ? "0" : `${body.scrollHeight}px`;
            header?.setAttribute("data-open", String(!this.isCollapsed));
            (header as HTMLElement).style.setProperty("--arrow-rotation", this.isCollapsed ? "0" : "90deg");
        };

        if (header && body) {
            header.addEventListener("click", () => {
                this.isCollapsed = !this.isCollapsed;
                body.classList.toggle("expanded", !this.isCollapsed);
                updateBodyHeight();
            });

            if (this.blockData?.content) {
                this.registry.getInterpreter().render(body, this.blockData.content);
            }

            updateBodyHeight();
        }
        // TODO: Fix arrow not update to correct state
    }
}
