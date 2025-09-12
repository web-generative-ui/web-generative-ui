import type {Box} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {applyLayoutMeta} from "../core/common.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiBox` is a flexible container component that arranges its children using CSS Flexbox properties.
 * It allows control over a direction, spacing (gap), alignment, justification, and wrapping of child elements.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Box` object.
 *
 * @element ui-box
 * @slot (default) Renders child components passed in its `children` property.
 */
export class UiBox extends BaseUiComponent {

    /**
     * The parsed data for the box component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private boxData: Box | null = null;

    /**
     * Constructs an instance of `UiBox`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({mode: "open"});
    }

    /**
     * Parses the JSON string from the `data` attribute into a `Box` object.
     * If parsing fails, an error is logged, and `boxData` is set to `null`.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            this.boxData = JSON.parse(dataString) as Box;
        } catch (e: unknown) {
            console.error("UiBox: Failed to parse data attribute:", e);
            this.boxData = null;
        }
    }

    /**
     * Indicates whether the `boxData` has been successfully parsed.
     * @protected
     * @returns `true` if `boxData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.boxData !== null;
    }

    /**
     * Renders the HTML content of the box into the component's Shadow DOM.
     * It sets up a flexbox container based on `boxData` properties and renders
     * its children by delegating to the `Registry` and `Interpreter`.
     * @protected
     */
    protected renderContent(): void {
        if (!this.boxData) {
            this.shadow.innerHTML = '';
            return;
        }

        const {
            direction = 'column',
            gap,
            align,
            justify,
            wrap,
            children = []
        } = this.boxData;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    ${this.boxData.style ? formatInlineStyle(this.boxData.style) : ''}
                    ${this.boxData.layout ? formatLayoutMetaAsHostStyle(this.boxData.layout) : ''}
                }
                .box-container {
                    display: flex;
                    flex-direction: ${direction};
                    ${gap ? `gap: ${gap};` : ''}
                    ${align ? `align-items: ${align};` : ''}
                    ${justify ? `justify-content: ${justify};` : ''}
                    ${wrap ? 'flex-wrap: wrap;' : ''}
                    width: 100%;
                    height: 100%;
                }
                .child-wrapper {
                    display: flex;
                }
            </style>
            <div class="box-container"></div>
        `;

        const contentContainer = this.shadow.querySelector('.box-container');
        if (contentContainer && Array.isArray(children)) {
            for (const child of children) {
                if (!child) continue;

                const wrapper = document.createElement("div");
                wrapper.classList.add("child-wrapper");

                applyLayoutMeta(wrapper, child.layout);
                if (child.style) {
                    Object.assign(wrapper.style, child.style);
                }


                contentContainer.appendChild(wrapper);
                this.registry.getInterpreter().render(wrapper, child);
            }
        }
    }
}
