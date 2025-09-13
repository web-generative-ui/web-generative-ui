import type {Grid} from "../schema.d.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {applyLayoutMeta} from "../core/common.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiGrid` is a custom UI component that renders its children in a flexible CSS Grid layout.
 * It allows defining column structures and gap spacing between grid items.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Grid` object.
 *
 * @element ui-grid
 * @slot (default) Renders child components passed in its `children` property.
 */
export class UiGrid extends BaseUiComponent {

    /**
     * The parsed data for the grid component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private gridData: Grid | null = null;

    /**
     * Constructs an instance of `UiGrid`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the JSON string from the `data` attribute into a `Grid` object.
     * It includes basic validation to ensure the component type is 'grid'.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "grid") {
                throw new Error("Invalid grid component data: 'component' must be 'grid'.");
            }
            this.gridData = parsed as Grid;
        } catch (e: unknown) {
            console.error("UiGrid: Failed to parse data attribute:", e);
            this.gridData = null;
        }
    }

    /**
     * Indicates whether the `gridData` has been successfully parsed.
     * @protected
     * @returns `true` if `gridData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.gridData !== null;
    }

    /**
     * Renders the HTML content of the grid into the component's Shadow DOM.
     * It sets up the CSS Grid layout based on `columns` and `gap` properties,
     * and delegates rendering of its children to the `Interpreter`.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.gridData) {
            this.shadow.innerHTML = '<p style="color: red; text-align: center;">Invalid or missing grid data.</p>';
            return;
        }

        const { gap = "1rem", children = [] } = this.gridData;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%; /* Take full available width */
                    box-sizing: border-box; /* Include padding/border in width */
                    ${this.gridData.style ? formatInlineStyle(this.gridData.style) : ''}
                    ${this.gridData.layout ? formatLayoutMetaAsHostStyle(this.gridData.layout) : ''}
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                .grid-container {
                    display: grid;
                    grid-template-columns: ${this.resolveColumns()};
                    gap: ${gap};
                    width: 100%;
                    height: 100%;
                }
                .child-wrapper {
                    display: contents;
                }
            </style>
            <div class="grid-container"></div>
        `;

        const gridContainer = this.shadow.querySelector(".grid-container");
        if (gridContainer && Array.isArray(children)) {
            for (const child of children) {
                if (!child) continue;

                const wrapper = document.createElement("div");
                wrapper.classList.add("child-wrapper");

                applyLayoutMeta(wrapper, child.layout);
                if (child.style) {
                    Object.assign(wrapper.style, child.style);
                }

                gridContainer.appendChild(wrapper);
                this.registry.getInterpreter().render(wrapper, child);
            }
        }
    }

    /**
     * Resolves the `columns` property from `gridData` into a valid CSS `grid-template-columns` value.
     * If `columns` is a number, it's converted to `repeat(N, 1fr)`.
     * If `columns` is a string, it's used directly. Defaults to '1fr'.
     * @private
     * @returns A CSS string for `grid-template-columns`.
     */
    private resolveColumns(): string {
        if (this.gridData?.columns) {
            if (typeof this.gridData.columns === "number") {
                return `repeat(${this.gridData.columns}, 1fr)`;
            }
            return this.gridData.columns;
        }
        return "1fr";
    }
}
