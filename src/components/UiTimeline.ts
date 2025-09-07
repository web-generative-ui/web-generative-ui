import type {Timeline} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";

export class UiTimeline extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private timelineData: Timeline | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({mode: "open"});
    }

    protected parseData(data: string): void {
        try {
            const parsed = JSON.parse(data);
            if (parsed.component !== "timeline" || !Array.isArray(parsed.items)) {
                throw new Error("Invalid timeline component data");
            }
            this.timelineData = parsed;
            this.renderContent();
        } catch (e) {
            console.error("UiTimeline parseData error:", e);
            this.timelineData = null;
            this.renderContent();
        }
    }

    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color: red;">Invalid or missing timeline data</span>`;
            return;
        }

        const {orientation = "vertical", items} = this.timelineData!;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: sans-serif;
                }
                .timeline {
                    display: flex;
                    flex-direction: ${orientation === "horizontal" ? "row" : "column"};
                    gap: 1.5em;
                    position: relative;
                }
                .timeline-item {
                    position: relative;
                    display: flex;
                    flex-direction: ${orientation === "horizontal" ? "column" : "row"};
                    align-items: ${orientation === "horizontal" ? "center" : "flex-start"};
                }
                .marker {
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    margin-right: ${orientation === "vertical" ? "1em" : "0"};
                    margin-bottom: ${orientation === "horizontal" ? "0.5em" : "0"};
                    flex-shrink: 0;
                }
                .marker.completed { background: #4caf50; }
                .marker.active { background: #007acc; }
                .marker.upcoming { background: #aaa; }
                .marker.default { background: #ccc; }

                .content {
                    flex: 1;
                }
                .title {
                    font-weight: bold;
                }
                .time {
                    font-size: 0.85em;
                    color: #666;
                }
                .description {
                    margin-top: 0.25em;
                    font-size: 0.9em;
                    color: #444;
                }
                .media {
                    margin-top: 0.5em;
                }
            </style>
            <div class="timeline">
                ${items.map((item, idx: number) => `
                    <div class="timeline-item" data-idx="${idx}">
                        <div class="marker ${item.status ?? "default"}"></div>
                        <div class="content">
                            ${item.time ? `<div class="time">${item.time}</div>` : ""}
                            <div class="title">${item.title}</div>
                            ${item.description ? `<div class="description">${item.description}</div>` : ""}
                            <div class="media"></div>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;

        // Render optional icon/media
        const itemEls = this.shadow.querySelectorAll(".timeline-item");
        items.forEach((item, idx: number) => {
            const itemEl = itemEls[idx] as HTMLElement;
            const mediaEl = itemEl.querySelector(".media") as HTMLElement;

            if (item.icon) {
                this.registry.getInterpreter().render(mediaEl, [item.icon]);
            }
            if (item.media) {
                this.registry.getInterpreter().render(mediaEl, [item.media]);
            }
        });
    }

    protected hasParsedData(): boolean {
        return this.timelineData !== null;
    }
}
