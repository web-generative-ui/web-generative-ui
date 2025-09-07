import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Stream} from "../schema.ts";

export class UiStream extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private streamData: Stream | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(data: string): void {
        try {
            const parsed = JSON.parse(data);
            if (parsed.component !== "stream" || !Array.isArray(parsed.items)) {
                throw new Error("Invalid stream component data");
            }
            this.streamData = parsed;
            this.renderContent();
        } catch (e) {
            console.error("UiStream parseData error:", e);
            this.streamData = null;
            this.renderContent();
        }
    }

    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color: red;">Invalid or missing stream data</span>`;
            return;
        }

        const { direction = "down", items } = this.streamData!;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: sans-serif;
                }
                .stream {
                    display: flex;
                    flex-direction: column;
                    gap: 1em;
                }
                .stream.up {
                    flex-direction: column-reverse;
                }
                .item {
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    padding: 0.75em 1em;
                    background: #fafafa;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85em;
                    margin-bottom: 0.5em;
                    color: #666;
                }
                .author {
                    font-weight: bold;
                }
                .status {
                    font-size: 0.75em;
                    margin-left: 0.5em;
                }
                .status.pending { color: #999; }
                .status.completed { color: #4caf50; }
                .status.error { color: #e53935; }
                .content {
                    margin-top: 0.25em;
                }
            </style>
            <div class="stream ${direction}">
                ${items
            .map(
                (item, idx) => `
                        <div class="item" data-idx="${idx}">
                            <div class="header">
                                <span class="author">${item.author ?? ""}</span>
                                <span>
                                    ${item.timestamp ?? ""}
                                    ${
                    item.status
                        ? `<span class="status ${item.status}">${item.status}</span>`
                        : ""
                }
                                </span>
                            </div>
                            <div class="content"></div>
                        </div>
                    `
            )
            .join("")}
            </div>
        `;

        const itemEls = this.shadow.querySelectorAll(".item");
        items.forEach((item, idx) => {
            const contentEl = itemEls[idx].querySelector(".content") as HTMLElement;

            if (typeof item.content === "string") {
                contentEl.textContent = item.content;
            } else {
                this.registry.getInterpreter().render(contentEl, [item.content]);
            }
        });
    }

    protected hasParsedData(): boolean {
        return this.streamData !== null;
    }
}
