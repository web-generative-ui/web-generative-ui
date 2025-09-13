import type {Card, TransitionConfig} from '../schema.d.ts';
import {BaseUiComponent} from './BaseUiComponent';
import {applyLayoutMeta} from "../core/common.ts";

/**
 * `UiCard` is a custom UI component that renders a versatile container with a title
 * and optional child components. It provides a structured way to group related UI elements.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Card` object.
 *
 * @element ui-card
 * @slot (default) Renders child components passed in its `children` property.
 */
export class UiCard extends BaseUiComponent {

    /**
     * The parsed data for the card component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private cardData: Card | null = null;

    /**
     * Constructs an instance of `UiCard`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for card enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'card-slide-enter',
        enterActive: 'card-slide-enter-active',
        exit: 'card-slide-exit',
        exitActive: 'card-slide-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Card` object.
     * If parsing fails, an error is logged, and `cardData` is set to `null`.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            this.cardData = JSON.parse(dataString) as Card;
        } catch (e) {
            console.error("UiCard: Failed to parse data attribute:", e);
            this.cardData = null;
        }
    }

    /**
     * Indicates whether the `cardData` has been successfully parsed.
     * @protected
     * @returns `true` if `cardData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.cardData !== null;
    }

    /**
     * Renders the HTML content of the card into the component's Shadow DOM.
     * It sets up the card's title and renders its children by delegating to the
     * `Registry` and `Interpreter`.
     * @protected
     */
    protected renderContent(): void {
        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box;
                }
                .card {
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    background: #fff;
                    transition: box-shadow 0.2s ease, transform 0.2s ease;
                }
                .card:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    transform: translateY(-2px);
                }
                h3 {
                    margin: 0 0 8px 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #333;
                }
                .card-content {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .child-wrapper {
                    display: block;
                }
            </style>
            <div class="card">
                <h3>${this.cardData?.title || ''}</h3>
                <div class="card-content"></div>
            </div>
        `;

        const { children } = this.cardData ?? {};
        if (Array.isArray(children) && children.length > 0) {
            const contentContainer = this.shadow.querySelector('.card-content');
            if (contentContainer) {
                for (const child of children) {
                    const wrapper = document.createElement("div");
                    wrapper.classList.add("child-wrapper");

                    applyLayoutMeta(wrapper, child.layout);

                    contentContainer.appendChild(wrapper);
                    this.registry.getInterpreter().render(wrapper, child);
                }
            }
        }
    }
}
