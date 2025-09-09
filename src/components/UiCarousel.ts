import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Carousel, TransitionConfig} from "../schema.ts";

export class UiCarousel extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private carouselData: Carousel | null = null;
    private activeIndex: number = 0;
    private autoplayTimer: number | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'carousel-item-enter',
        enterActive: 'carousel-item-enter-active',
        exit: 'carousel-item-exit',
        exitActive: 'carousel-item-exit-active'
    };

    protected parseData(data: string): void {
        try {
            const parsed = JSON.parse(data);
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

    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color: red;">Invalid or missing carousel data</span>`;
            return;
        }

        const { items } = this.carouselData!;
        const activeIdx = this.activeIndex;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    overflow: hidden;
                }
                .carousel-container {
                    display: flex;
                    transition: transform 0.5s ease;
                    width: 100%;
                }
                .carousel-item {
                    flex: 0 0 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .controls {
                    position: absolute;
                    top: 50%;
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    transform: translateY(-50%);
                }
                .control-btn {
                    background: rgba(0, 0, 0, 0.5);
                    color: white;
                    border: none;
                    padding: 0.5em 1em;
                    cursor: pointer;
                    border-radius: 4px;
                }
                .indicators {
                    position: absolute;
                    bottom: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 6px;
                }
                .indicator {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #ccc;
                    cursor: pointer;
                }
                .indicator.active {
                    background: #007acc;
                }
            </style>
            <div class="carousel-container" style="transform: translateX(-${activeIdx * 100}%);">
                ${items.map(() => `<div class="carousel-item"></div>`).join("")}
            </div>
            <div class="controls">
                <button class="control-btn prev">&lt;</button>
                <button class="control-btn next">&gt;</button>
            </div>
            <div class="indicators">
                ${items
            .map((_, idx) => `<div class="indicator ${idx === activeIdx ? "active" : ""}" data-idx="${idx}"></div>`)
            .join("")}
            </div>
        `;

        const itemEls = this.shadow.querySelectorAll(".carousel-item");

        // Render each item with interpreter
        items.forEach((child, idx) => {
            const itemEl = itemEls[idx] as HTMLElement;
            itemEl.innerHTML = "";
            this.registry.getInterpreter().render(itemEl, [child]);
        });

        // Controls
        const prevBtn = this.shadow.querySelector(".prev");
        const nextBtn = this.shadow.querySelector(".next");

        prevBtn?.addEventListener("click", () => this.showPrev());
        nextBtn?.addEventListener("click", () => this.showNext());

        // Indicators
        const indicators = this.shadow.querySelectorAll(".indicator");
        indicators.forEach((ind) => {
            ind.addEventListener("click", () => {
                const idx = Number((ind as HTMLElement).dataset.idx);
                this.showIndex(idx);
            });
        });
    }

    private showPrev(): void {
        if (!this.carouselData) return;
        this.activeIndex = (this.activeIndex - 1 + this.carouselData.items.length) % this.carouselData.items.length;
        this.renderContent();
        this.resetAutoplay();
    }

    private showNext(): void {
        if (!this.carouselData) return;
        this.activeIndex = (this.activeIndex + 1) % this.carouselData.items.length;
        this.renderContent();
        this.resetAutoplay();
    }

    private showIndex(idx: number): void {
        if (!this.carouselData) return;
        this.activeIndex = idx;
        this.renderContent();
        this.resetAutoplay();
    }

    private setupAutoplay(): void {
        if (this.carouselData?.autoplay && this.carouselData.items.length > 1) {
            const interval = this.carouselData.interval ?? 3000;
            this.autoplayTimer = window.setInterval(() => this.showNext(), interval);
        }
    }

    private clearAutoplay(): void {
        if (this.autoplayTimer !== null) {
            clearInterval(this.autoplayTimer);
            this.autoplayTimer = null;
        }
    }

    private resetAutoplay(): void {
        this.clearAutoplay();
        this.setupAutoplay();
    }

    protected hasParsedData(): boolean {
        return this.carouselData !== null;
    }
}
