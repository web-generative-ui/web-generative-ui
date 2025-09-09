import type {Box} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {applyLayoutMeta} from "../core/common.ts";

export class UiBox extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private boxData: Box | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(dataString: string): void {
        try {
            this.boxData = JSON.parse(dataString) as Box;
        } catch (e) {
            console.error("UiCard: Failed to parse data attribute:", e);
            this.boxData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.boxData !== null;
    }

    protected renderContent(): void {
        const { direction = 'column', gap, align, justify, wrap, children } = this.boxData ?? {};

        this.shadow.innerHTML = `
        <style>
            :host { display: block; }
            .box {
                display: flex;
                flex-direction: ${direction};
                ${gap ? `gap: ${gap};` : ''}
                ${align ? `align-items: ${align};` : ''}
                ${justify ? `justify-content: ${justify};` : ''}
                ${wrap ? 'flex-wrap: wrap;' : ''}
            }
            .box-content {
                display: flex;
                flex-direction: ${direction};
                width: 100%;
            }
            .child-wrapper {
                display: flex; /* lets layout grow/shrink work */
            }
        </style>
        <div class="box">
            <div class="box-content"></div>
        </div>
    `;

        if (Array.isArray(children) && children.length > 0) {
            const contentContainer = this.shadow.querySelector('.box-content');
            if (contentContainer) {
                for (const child of children) {
                    const wrapper = document.createElement("div");
                    wrapper.classList.add("child-wrapper");

                    applyLayoutMeta(wrapper, child.layout);

                    contentContainer.appendChild(wrapper);
                    this.registry.getInterpreter().render(wrapper, child);
                }
            }
        }    }
}
