import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Carousel, Icon, TransitionConfig} from "../schema.ts";
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

    private _showPrevBound = this.showPrev.bind(this);
    private _showNextBound = this.showNext.bind(this);
    private _handleIndicatorClickBound = this._handleIndicatorClick.bind(this);

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
            // Basic validation to ensure essential carousel properties are present
            if (parsed.component !== "carousel" || !Array.isArray(parsed.items)) {
                throw new Error("Invalid carousel component data: 'component' must be 'carousel' and 'items' must be an array.");
            }
            this.carouselData = parsed as Carousel;
            this.activeIndex = 0; // Reset active index when data changes
            this.clearAutoplay(); // Clear autoplay on new data
        } catch (e: unknown) {
            console.error("UiCarousel: Failed to parse data attribute:", e);
            this.carouselData = null; // Clear data on error
            this.activeIndex = 0;
            this.clearAutoplay(); // Ensure autoplay is off on error
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
     * @override
     */
    override connectedCallback(): void {
        super.connectedCallback(); // Call BaseUiComponent's connectedCallback first
        this.renderContent(); // Initial full render of the component's HTML structure
        this._setupListeners(); // Attach event listeners at once
        this._updateCarouselState(); // Apply initial state (transform, indicators)
        this.setupAutoplay(); // Start autoplay if enabled
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
            this.renderContent(); // Re-render the static structure and then update dynamic parts.
            this._removeListeners(); // Clean up old listeners
            this._setupListeners(); // Re-attach listeners to new DOM elements
            this._updateCarouselState(); // Apply new state (transform, indicators)
            this.resetAutoplay(); // Reset autoplay for new data
        }
    }

    /**
     * **(Implemented abstract method)**
     * Renders the initial HTML structure of the carousel, including its items,
     * navigation controls, and indicators. It delegates the rendering of individual
     * carousel items to the `Interpreter`.
     * This method is called during initial setup or when the `data` attribute changes.
     * Later state changes (`activeIndex`) are handled by `_updateCarouselState`.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.carouselData || this.carouselData.items.length === 0) {
            this.shadow.innerHTML = `<p style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Invalid or missing carousel data.</p>`;
            this.clearAutoplay();
            return;
        }

        const { items } = this.carouselData;
        // Preload nested component definitions for all carousel items (best-effort, non-blocking)
        try {
            this.registry.ensurePayloadComponentsDefined(items).catch(e => console.warn("UiCarousel: Failed to preload carousel item components:", e));
        } catch (e: unknown) {
            console.warn("UiCarousel: Error during carousel item component preloading:", e);
        }

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    overflow: hidden;
                    width: 100%;
                    min-height: 150px; /* Provide a min-height to prevent collapse if items are empty */
                    border-radius: 8px; /* Consistent rounded corners for the carousel */
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    background-color: #f8f8f8;
                    ${this.carouselData.style ? formatInlineStyle(this.carouselData.style) : ''}
                    ${this.carouselData.layout ? formatLayoutMetaAsHostStyle(this.carouselData.layout) : ''}
                    /* Base transitions for host element (if any) */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                .carousel-wrapper { /* Added wrapper for better layout control */
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                .carousel-container {
                    display: flex;
                    transition: transform 0.5s ease-in-out; /* Smooth transitions */
                    width: 100%; /* Important for sliding effect */
                    height: 100%;
                }
                .carousel-item {
                    flex: 0 0 100%; /* Each item takes full width of container */
                    max-width: 100%;
                    box-sizing: border-box;
                    height: 100%; /* Ensure item fills its allocated height */
                    overflow: auto; /* Allow scrolling if content is too large */
                    padding: 1em; /* Padding inside each carousel item */
                }
                .controls {
                    position: absolute;
                    top: 50%;
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: space-between;
                    transform: translateY(-50%);
                    z-index: 10; /* Ensure controls are above items */
                }
                .control-btn {
                    background: rgba(0, 0, 0, 0.5);
                    color: white;
                    border: none;
                    width: 40px; /* Fixed width for button */
                    height: 40px; /* Fixed height for button */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border-radius: 50%; /* Round buttons */
                    font-size: 1.2em; /* Icon size */
                    line-height: 1;
                    opacity: 0.7;
                    transition: opacity 0.2s, background 0.2s;
                    margin: 0 10px; /* Margin from the edges */
                }
                .control-btn:hover {
                    opacity: 1;
                    background: rgba(0, 0, 0, 0.8);
                }
                .control-btn ui-icon {
                    color: white; /* Ensure icon color */
                }
                .indicators {
                    position: absolute;
                    bottom: 15px; /* Pushed slightly up from bottom */
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 8px; /* Increased gap */
                    padding: 5px 10px; /* Padding for the indicator strip */
                    background: rgba(0, 0, 0, 0.3); /* Darker background for indicators */
                    border-radius: 10px;
                    z-index: 10; /* Ensure indicators are above items */
                }
                .indicator {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #ccc; /* Inactive indicator color */
                    cursor: pointer;
                    border: 1px solid rgba(255,255,255,0.4); /* White border for better contrast */
                    transition: background 0.3s ease, border-color 0.3s ease;
                }
                .indicator.active {
                    background: #007bff; /* Active indicator color */
                    border-color: #007bff;
                }
            </style>
            <div class="carousel-wrapper">
                <div class="carousel-container">
                    ${items.map(() => `<div class="carousel-item"></div>`).join("")}
                </div>
                ${items.length > 1 ? `
                    <div class="controls">
                        <button class="control-btn prev" aria-label="Previous slide">
                            ${this._renderIcon({component: 'icon', name: 'chevron_left'})}
                        </button>
                        <button class="control-btn next" aria-label="Next slide">
                            ${this._renderIcon({component: 'icon', name: 'chevron_right'})}
                        </button>
                    </div>
                    <div class="indicators" role="tablist">
                        ${items
            .map((_, idx) => `<div class="indicator" data-idx="${idx}" role="tab" aria-label="Go to slide ${idx + 1}"></div>`)
            .join("")}
                    </div>
                ` : ''}
            </div>
        `;

        const carouselContainerEl = this.shadow.querySelector(".carousel-container") as HTMLElement;
        const itemEls = this.shadow.querySelectorAll(".carousel-item");

        if (carouselContainerEl && itemEls.length === items.length) {
            // Render each item with the interpreter only once when the HTML structure is built
            items.forEach((child, idx) => {
                const itemEl = itemEls[idx] as HTMLElement;
                itemEl.innerHTML = ""; // Clear existing content before rendering new
                // For carousel items, render each child wrapped in an array, so Interpreter treats it as a single root
                this.registry.getInterpreter().render(itemEl, [child]);
            });
        }
    }

    /**
     * Attaches necessary event listeners to the carousel's internal elements.
     * This method is called after `renderContent` to ensure elements exist.
     * It is typically called once in `connectedCallback` and again if `renderContent`
     * fully rebuilds the HTML (e.g., due to `data` attribute change).
     * @private
     */
    private _setupListeners(): void {
        const { items = [] } = this.carouselData || {};
        if (items.length <= 1) return; // No need for listeners if 0 or 1 item.

        // Remove existing listeners first to prevent duplicates if called multiple times
        const prevBtn = this.shadow.querySelector(".prev");
        const nextBtn = this.shadow.querySelector(".next");
        const indicators = this.shadow.querySelectorAll(".indicator");

        prevBtn?.removeEventListener("click", this._showPrevBound);
        nextBtn?.removeEventListener("click", this._showNextBound);
        indicators.forEach(ind => ind.removeEventListener("click", this._handleIndicatorClickBound));

        // Add new listeners
        prevBtn?.addEventListener("click", this._showPrevBound);
        nextBtn?.addEventListener("click", this._showNextBound);
        indicators.forEach(ind => ind.addEventListener("click", this._handleIndicatorClickBound));
    }

    /**
     * Removes all event listeners to prevent memory leaks, especially when the component is disconnected
     * or its `innerHTML` is replaced.
     * @private
     */
    private _removeListeners(): void {
        const prevBtn = this.shadow.querySelector(".prev");
        const nextBtn = this.shadow.querySelector(".next");
        const indicators = this.shadow.querySelectorAll(".indicator");

        prevBtn?.removeEventListener("click", this._showPrevBound);
        nextBtn?.removeEventListener("click", this._showNextBound);
        indicators.forEach(ind => ind.removeEventListener("click", this._handleIndicatorClickBound));
    }

    /**
     * Handles a click event on an indicator dot, showing the corresponding slide.
     * @private
     * @param event The click event.
     */
    private _handleIndicatorClick(event: Event): void {
        const indicator = event.currentTarget as HTMLElement;
        const idx = Number(indicator.dataset.idx);
        this.showIndex(idx);
    }

    /**
     * Navigates the carousel to the previous item, wrapping around to the end if at the first item.
     * @private
     */
    private showPrev(): void {
        if (!this.carouselData || this.carouselData.items.length === 0) return;
        this.activeIndex = (this.activeIndex - 1 + this.carouselData.items.length) % this.carouselData.items.length;
        this._updateCarouselState(); // Update UI without full re-render
        this.resetAutoplay(); // Reset autoplay timer
    }

    /**
     * Navigates the carousel to the next item, wrapping around to the beginning if at the last item.
     * @private
     */
    private showNext(): void {
        if (!this.carouselData || this.carouselData.items.length === 0) return;
        this.activeIndex = (this.activeIndex + 1) % this.carouselData.items.length;
        this._updateCarouselState(); // Update UI without full re-render
        this.resetAutoplay(); // Reset autoplay timer
    }

    /**
     * Navigates the carousel to a specific item by its index.
     * @private
     * @param idx The zero-based index of the item to show.
     */
    private showIndex(idx: number): void {
        if (!this.carouselData || this.carouselData.items.length === 0 || idx < 0 || idx >= this.carouselData.items.length) return;
        this.activeIndex = idx;
        this._updateCarouselState(); // Update UI without full re-render
        this.resetAutoplay(); // Reset autoplay timer
    }

    /**
     * Updates the visual state of the carousel (slide position and active indicator)
     * without re-rendering the entire HTML structure.
     * @private
     */
    private _updateCarouselState(): void {
        const carouselContainerEl = this.shadow.querySelector(".carousel-container") as HTMLElement;
        const indicators = this.shadow.querySelectorAll(".indicator");

        if (carouselContainerEl) {
            carouselContainerEl.style.transform = `translateX(-${this.activeIndex * 100}%)`;
        }

        indicators.forEach((ind, idx) => {
            ind.classList.toggle("active", idx === this.activeIndex);
            ind.setAttribute('aria-selected', String(idx === this.activeIndex));
        });
    }

    /**
     * Sets up the autoplay timer if `autoplay` is enabled in `carouselData` and there are multiple items.
     * @private
     */
    private setupAutoplay(): void {
        if (this.carouselData?.autoplay && this.carouselData.items.length > 1 && this.autoplayTimer === null) {
            const interval = this.carouselData.interval ?? 3000; // Default to 3 seconds
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

    /**
     * Renders a `ui-icon` child component as an HTML string.
     * @private
     * @param iconData The data for the icon component.
     * @returns An HTML string representing the `ui-icon` element.
     */
    private _renderIcon(iconData: Icon): string {
        const iconJsonData = JSON.stringify({
            component: "icon",
            name: iconData.name,
            variant: iconData.variant ?? "filled",
            size: iconData.size ? (typeof iconData.size === 'number' ? `${iconData.size}px` : iconData.size) : "1.2em",
        });
        return `<ui-icon data='${iconJsonData}'></ui-icon>`;
    }
}
