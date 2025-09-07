import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Reference} from "../schema.ts";

export class UiReference extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private refData: Reference | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(data: string): void {
        try {
            const parsed = JSON.parse(data);
            if (parsed.component !== "reference" || !parsed.label || !parsed.target) {
                throw new Error("Invalid reference component data");
            }
            this.refData = parsed;
            this.renderContent();
        } catch (e) {
            console.error("UiReference parseData error:", e);
            this.refData = null;
            this.renderContent();
        }
    }

    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color: red;">Invalid or missing reference data</span>`;
            return;
        }

        const { label, target, description } = this.refData!;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: sans-serif;
                    margin: 0.5em 0;
                }
                a {
                    color: #007acc;
                    text-decoration: none;
                    font-weight: bold;
                }
                a:hover {
                    text-decoration: underline;
                }
                .description {
                    display: block;
                    font-size: 0.9em;
                    color: #555;
                    margin-top: 0.25em;
                }
            </style>
            <a href="${target}" target="_blank" rel="noopener noreferrer">${label}</a>
            ${description ? `<span class="description">${description}</span>` : ""}
        `;
    }

    protected hasParsedData(): boolean {
        return this.refData !== null;
    }
}
