import type {Spacer} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";

export class UiSpacer extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private spacerData: Spacer | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(dataString: string) {
        try {
            this.spacerData = JSON.parse(dataString) as Spacer;
        } catch (e) {
            console.error("UiSpacer: Failed to parse data attribute:", e);
            this.spacerData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.spacerData !== null;
    }

    protected renderContent(): void {
        if (!this.spacerData) return;

        const size = this.spacerData.size || "1rem";
        const isHorizontal = this.spacerData.direction === "horizontal";

        this.shadow.innerHTML = `
            <style>
                :host { display: block; }
                .spacer {
                    display: block;
                    ${isHorizontal
            ? `width: ${size}; height: 100%;`
            : `width: 100%; height: ${size};`}
                }
            </style>
            <div class="spacer"></div>
        `;
    }
}
