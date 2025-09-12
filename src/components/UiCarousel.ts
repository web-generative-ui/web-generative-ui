import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Carousel, TransitionConfig} from "../schema.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiCarousel` is a custom UI component that renders a rotating display of various items (images, cards, videos).
 * It supports automatic playback, navigation controls, and indicators.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Carousel` object.
 *
 * @element ui-carousel
 * @slot (default) Renders items provided in its `items` property.
 */
export class UiCarousel extends BaseUiComponent {

    /**
     * The parsed data for the carousel component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private carouselData: Carousel | null = null;
    /**
     * The index of the currently active item displayed in the carousel.
     * @private
     */
    private activeIndex: number = 0;
    /**
     * The timer ID for the autoplay functionality. `null` if autoplay is not active.
     * @private
     */
    private autoplayTimer: number | null = null;

    /**
     * Constructs an instance of `UiCarousel`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for carousel item enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'carousel-item-enter',
        enterActive: 'carousel-item-enter-active',
        exit: 'carousel-item-exit',
        exitActive: 'carousel-item-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Carousel` object.
     * It validates the structure to ensure its valid carousel data.
     * This method is responsible only for data parsing, not rendering, or autoplay setup.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "carousel" || !Array.isArray(parsed.items)) {
                throw new Error("Invalid carousel component data");
            }
            this.carouselData = parsed;
            this.activeIndex = 0;
            this.clearAutoplay();
            this.renderContent();
            this.setupAutoplay();
        } catch (e) {
            console.error("UiCarousel parseData error:", e);
            this.carouselData = null;
            this.activeIndex = 0;
            this.clearAutoplay();
            this.renderContent();
        }
    }

    /**
     * Indicates whether the `carouselData` has been successfully parsed.
     * @protected
     * @returns `true` if `carouselData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.carouselData !== null;
    }

    /**
     * Extends `connectedCallback` from `BaseUiComponent` to perform initial rendering
     * and set up autoplay after the component is connected to the DOM.
     */
    override connectedCallback(): void {
        super.connectedCallback();
        this.setupAutoplay();
    }

    /**
     * Renders the HTML structure of the carousel, including its items, navigation controls, and indicators.
     * It delegates the rendering of individual carousel items to the `Interpreter`.
     * This method is called whenever the carousel's state (`activeIndex`) or data changes.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.carouselData || this.carouselData.items.length === 0) {
            this.shadow.innerHTML = `<p style="color: red; text-align: center;">Invalid or missing carousel data.</p>`;
            this.clearAutoplay();
            return;
        }

        const { items } = this.carouselData;
        this.activeIndex = Math.max(0, Math.min(this.activeIndex, items.length - 1));
        const activeIdx = this.activeIndex;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    overflow: hidden;
                    width: 100%;
                    min-height: 150px;
                    ${this.carouselData.style ? formatInlineStyle(this.carouselData.style) : ''}
                    ${this.carouselData.layout ? formatLayoutMetaAsHostStyle(this.carouselData.layout) : ''}
                }
                .carousel-wrapper {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                .carousel-container {
                    display: flex;
                    transition: transform 0.5s ease-in-out;
                    width: 100%;
                    height: 100%;
                }
                .carousel-item {
                    flex: 0 0 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                    height: 100%;
                    overflow: auto;
                }
                .controls {
                    position: absolute;
                    top: 50%;
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    transform: translateY(-50%);
                    padding: 0 10px;
                    box-sizing: border-box;
                    pointer-events: none;
                }
                .control-btn {
                    background: rgba(0, 0, 0, 0.6);
                    color: white;
                    border: none;
                    padding: 0.8em 1.2em;
                    cursor: pointer;
                    border-radius: 50%;
                    font-size: 1.2em;
                    line-height: 1;
                    opacity: 0.7;
                    transition: opacity 0.2s, background 0.2s;
                    pointer-events: all;
                }
                .control-btn:hover {
                    opacity: 1;
                    background: rgba(0, 0, 0, 0.8);
                }
                .indicators {
                    position: absolute;
                    bottom: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 8px;
                    padding: 5px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                }
                .indicator {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #ccc;
                    cursor: pointer;
                    border: 1px solid rgba(0,0,0,0.2);
                    transition: background 0.3s;
                }
                .indicator.active {
                    background: #007acc;
                    border-color: #007acc;
                }
            </style>
            <div class="carousel-wrapper">
                <div class="carousel-container" style="transform: translateX(-${activeIdx * 100}%);">
                    ${items.map(() => `<div class="carousel-item"></div>`).join("")}
                </div>
                ${items.length > 1 ? `
                    <div class="controls">
                        <button class="control-btn prev" aria-label="Previous slide">&lt;</button>
                        <button class="control-btn next" aria-label="Next slide">&gt;</button>
                    </div>
                    <div class="indicators">
                        ${items
            .map((_, idx) => `<div class="indicator ${idx === activeIdx ? "active" : ""}" data-idx="${idx}" role="button" aria-label="Go to slide ${idx + 1}"></div>`)
            .join("")}
                    </div>
                ` : ''}
            </div>
        `;

        const carouselContainerEl = this.shadow.querySelector(".carousel-container") as HTMLElement;
        const itemEls = this.shadow.querySelectorAll(".carousel-item");

        if (carouselContainerEl && itemEls.length === items.length) {
            items.forEach((child, idx) => {
                const itemEl = itemEls[idx] as HTMLElement;
                itemEl.innerHTML = "";
                this.registry.getInterpreter().render(itemEl, [child]);
            });

            if (items.length > 1) {
                const prevBtn = this.shadow.querySelector(".prev");
                const nextBtn = this.shadow.querySelector(".next");
                const indicators = this.shadow.querySelectorAll(".indicator");

                prevBtn?.addEventListener("click", () => this.showPrev());
                nextBtn?.addEventListener("click", () => this.showNext());

                indicators.forEach((ind) => {
                    ind.addEventListener("click", () => {
                        const idx = Number((ind as HTMLElement).dataset.idx);
                        this.showIndex(idx);
                    });
                });
            }
        }
    }

    /**
     * Navigates the carousel to the previous item, wrapping around to the end if at the first item.
     * @private
     */
    private showPrev(): void {
        if (!this.carouselData) return;
        this.activeIndex = (this.activeIndex - 1 + this.carouselData.items.length) % this.carouselData.items.length;
        this.renderContent();
        this.resetAutoplay();
    }

    /**
     * Navigates the carousel to the next item, wrapping around to the beginning if at the last item.
     * @private
     */
    private showNext(): void {
        if (!this.carouselData) return;
        this.activeIndex = (this.activeIndex + 1) % this.carouselData.items.length;
        this.renderContent();
        this.resetAutoplay();
    }

    /**
     * Navigates the carousel to a specific item by its index.
     * @private
     * @param idx The zero-based index of the item to show.
     */
    private showIndex(idx: number): void {
        if (!this.carouselData) return;
        this.activeIndex = idx;
        this.renderContent();
        this.resetAutoplay();
    }

    /**
     * Sets up the autoplay timer if `autoplay` is enabled in `carouselData` and there are multiple items.
     * @private
     */
    private setupAutoplay(): void {
        if (this.carouselData?.autoplay && this.carouselData.items.length > 1) {
            const interval = this.carouselData.interval ?? 3000;
            this.autoplayTimer = window.setInterval(() => this.showNext(), interval);
        }
    }

    /**
     * Clears any active autoplay timer.
     * @private
     */
    private clearAutoplay(): void {
        if (this.autoplayTimer !== null) {
            clearInterval(this.autoplayTimer);
            this.autoplayTimer = null;
        }
    }

    /**
     * Clears the current autoplay timer and then restarts it if autoplay is enabled.
     * Used after user interaction (manual navigation) to keep autoplay smooth.
     * @private
     */
    private resetAutoplay(): void {
        this.clearAutoplay();
        this.setupAutoplay();
    }
}
