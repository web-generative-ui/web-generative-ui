import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Image, TransitionConfig} from "../schema.ts";

export class UiImage extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private imageData: Image | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'image-fade-enter',
        enterActive: 'image-fade-enter-active',
        exit: 'image-fade-exit',
        exitActive: 'image-fade-exit-active'
    };

    protected parseData(dataString: string) {
        try {
            this.imageData = JSON.parse(dataString) as Image;
        } catch (e) {
            console.error("UiImage: Failed to parse data attribute:", e);
            this.imageData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.imageData !== null;
    }

    protected renderContent(): void {
        if (!this.imageData) return;

        const { src, alt = "image", caption, fit = "contain" } = this.imageData;

        this.shadow.innerHTML = `
            <style>
                :host { display: inline-block; }
                figure {
                    margin: 0;
                    display: inline-flex;
                    flex-direction: column;
                    align-items: center;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    object-fit: ${fit};
                    border-radius: 4px;
                    display: block;
                }
                figcaption {
                    margin-top: 6px;
                    font-size: 13px;
                    color: #666;
                    text-align: center;
                }
            </style>
            <figure>
                <img src="${src}" alt="${alt}" />
                ${caption ? `<figcaption>${caption}</figcaption>` : ""}
            </figure>
        `;
    }
}
