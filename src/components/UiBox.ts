import type {Box} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";

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
        this.shadow.innerHTML = `
        <style>
            :host { display: block; }
            .box {
                display: flex;
                flex-direction: column;
            }
            .box-content {
                display: flex;
                flex-direction: column;
            }
        </style>
        <div class="box">
            <div class="box-content"></div>
        </div>
    `;

        if (this.boxData?.children?.items) {
            const contentContainer = this.shadow.querySelector('.box-content');
            if (contentContainer) {
                this.registry.getInterpreter().render(contentContainer, this.boxData.children.items);
            }
        }
    }
}
