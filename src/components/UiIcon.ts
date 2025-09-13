import type {Icon} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {IconRegistry} from "../core/IconRegistry.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiIcon` is a custom UI component that renders SVG icons dynamically, leveraging a central `IconRegistry`.
 * It allows specifying icon name, variant, and size.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into an `Icon` object.
 *
 * @element ui-icon
 * @slot N/A
 */
export class UiIcon extends BaseUiComponent {

    /**
     * The parsed data for the icon component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private iconData: Icon | null = null;

    /**
     * Constructs an instance of `UiIcon`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the JSON string from the `data` attribute into an `Icon` object.
     * Includes validation to ensure the `component` type is 'icon' and `name` is present.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "icon" || !parsed.name) {
                throw new Error("Invalid icon component data: 'component' must be 'icon' and 'name' is required.");
            }
            this.iconData = parsed as Icon;
        } catch (e: unknown) {
            console.error("UiIcon: Failed to parse data attribute:", e);
            this.iconData = null;
        }
    }

    /**
     * Indicates whether the `iconData` has been successfully parsed.
     * @protected
     * @returns `true` if `iconData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.iconData !== null;
    }

    /**
     * Renders the HTML content of the icon into the component's Shadow DOM.
     * It retrieves the SVG content from `IconRegistry` based on `name` and `variant`,
     * and applies sizing based on `size`.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.iconData) {
            this.shadow.innerHTML = `<span style="color: red; font-size: 1em;">⚠️ Icon data missing or invalid.</span>`;
            return;
        }

        const { name, variant = "filled", size = "1em" } = this.iconData;
        const svg = IconRegistry.getIcon(name, variant);

        // Ensure size is a string for CSS properties
        const cssSize = size;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: inline-flex; /* Ensures proper alignment with text/other inline elements */
                    ${this.iconData.style ? formatInlineStyle(this.iconData.style) : ''}
                    ${this.iconData.layout ? formatLayoutMetaAsHostStyle(this.iconData.layout) : ''}
                    /* Base transitions for enter/exit (if any defined in BaseUiComponent.transitionConfig) */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                .icon {
                    width: ${cssSize};
                    height: ${cssSize};
                    display: inline-flex; /* Ensure flex behavior for centering SVG */
                    align-items: center;
                    justify-content: center;
                }
                svg {
                    width: 100%; /* SVG fills its container */
                    height: 100%;
                    fill: currentColor; /* Inherits text color */
                    display: block; /* Remove any extra space below SVG */
                }
            </style>
            <span class="icon">
                ${svg || '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2zm.0001-3c-4.9706 0-9 4.0294-9 9s4.0294 9 9 9 9-4.0294 9-9-4.0294-9-9-9zm0 16c-3.866 0-7-3.134-7-7s3.134-7 7-7 7 3.134 7 7-3.134 7-7 7z"/></svg>'}
            </span>
        `;
        // Fallback to a generic error icon if SVG is empty/not found
        if (!svg) {
            console.warn(`UiIcon: No SVG found for icon '${name}' with variant '${variant}'. Displaying fallback error icon.`);
        }
    }
}
