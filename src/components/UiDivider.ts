import type {Divider} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";

export class UiDivider extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private dividerData: Divider | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(dataString: string) {
        try {
            this.dividerData = JSON.parse(dataString) as Divider;
        } catch (e) {
            console.error("UiDivider: Failed to parse data attribute:", e);
            this.dividerData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.dividerData !== null;
    }

    protected renderContent(): void {
        if (!this.dividerData) return;

        const orientation = this.dividerData.orientation || "horizontal";
        const label = this.dividerData.label;

        this.shadow.innerHTML = `
            <style>
                :host { display: block; }
                .divider {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    ${orientation === "vertical" ? `
                        flex-direction: column;
                        height: 100%;
                        width: auto;
                        padding: 0 0.5rem;
                    ` : `
                        flex-direction: row;
                        width: 100%;
                        height: auto;
                        padding: 0.5rem 0;
                    `}
                }
                .line {
                    flex: 1;
                    border: none;
                    ${orientation === "vertical"
            ? "border-left: 1px solid #ccc; height: 100%;"
            : "border-top: 1px solid #ccc; width: 100%;"}
                }
                .label {
                    margin: ${orientation === "vertical" ? "0.5rem 0" : "0 0.5rem"};
                    font-size: 0.875rem;
                    color: #666;
                    white-space: nowrap;
                }
            </style>
            <div class="divider">
                <hr class="line" />
                ${label ? `<span class="label">${label}</span><hr class="line" />` : ""}
            </div>
        `;
    }
}
