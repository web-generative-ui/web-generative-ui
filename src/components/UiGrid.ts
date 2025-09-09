import type {Grid} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {applyLayoutMeta} from "../core/common.ts";

export class UiGrid extends BaseUiComponent {

    protected shadow: ShadowRoot;
    private gridData: Grid | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(dataString: string) {
        try {
            this.gridData = JSON.parse(dataString) as Grid;
        } catch (e) {
            console.error("UiGrid: Failed to parse data attribute:", e);
            this.gridData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.gridData !== null;
    }

    protected renderContent(): void {
        if (!this.gridData) return;

        const { gap = "1rem", children } = this.gridData;

        this.shadow.innerHTML = `
            <style>
                :host { display: block; }
                .grid {
                    display: grid;
                    grid-template-columns: ${this.resolveColumns()};
                    gap: ${gap};
                }
                .child-wrapper {
                    display: block;
                }
            </style>
            <div class="grid"></div>
        `;

        const gridContainer = this.shadow.querySelector(".grid");
        if (gridContainer && Array.isArray(children) && children.length > 0) {
            for (const child of children) {
                const wrapper = document.createElement("div");
                wrapper.classList.add("child-wrapper");

                applyLayoutMeta(wrapper, child.layout);

                gridContainer.appendChild(wrapper);
                this.registry.getInterpreter().render(wrapper, child);
            }
        }
    }

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
