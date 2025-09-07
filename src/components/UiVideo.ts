import { BaseUiComponent } from "./BaseUiComponent.ts";

export class UiVideo extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private videoData: any = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(data: string): void {
        try {
            const parsed = JSON.parse(data);
            if (parsed.component !== "video" || !parsed.src) {
                throw new Error("Invalid video component data");
            }
            this.videoData = parsed;
            this.renderContent();
        } catch (e) {
            console.error("UiVideo parseData error:", e);
            this.videoData = null;
            this.renderContent();
        }
    }

    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color: red;">Invalid or missing video data</span>`;
            return;
        }

        const { src, poster, autoplay, loop, controls, muted } = this.videoData;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    max-width: 100%;
                }
                video {
                    width: 100%;
                    height: auto;
                    border-radius: 8px;
                }
            </style>
            <video
                src="${src}"
                ${poster ? `poster="${poster}"` : ""}
                ${autoplay ? "autoplay" : ""}
                ${loop ? "loop" : ""}
                ${controls ? "controls" : ""}
                ${muted ? "muted" : ""}
            ></video>
        `;
    }

    protected hasParsedData(): boolean {
        return this.videoData !== null;
    }
}
