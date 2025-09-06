import type {Grid} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";

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
            console.error("UiImage: Failed to parse data attribute:", e);
            this.gridData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.gridData !== null;
    }

    protected renderContent(): void {
        if (!this.gridData) return;

        this.shadow.innerHTML = `
            <style>
                :host { display: block; }
                .grid {
                    display: grid;
                    grid-template-columns: ${this.resolveColumns()};
                    gap: ${this.gridData.gap || '1rem'};
                }
            </style>
            <div class="grid"></div>
        `;

        const gridContainer = this.shadow.querySelector('.grid');
        if (gridContainer && this.gridData.children?.items) {
            this.registry.getInterpreter().render(gridContainer, this.gridData.children.items);
        }
    }

    private resolveColumns(): string {
        if (this.gridData && this.gridData.columns){
            if (typeof this.gridData.columns === 'number') {
                return `repeat(${this.gridData.columns}, 1fr)`;
            }
            return this.gridData.columns;
        }

        return '1fr';
    }
}
