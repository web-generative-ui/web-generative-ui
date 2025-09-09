import type {Card, TransitionConfig} from '../schema.ts';
import {BaseUiComponent} from './BaseUiComponent';
import {applyLayoutMeta} from "../core/common.ts";

export class UiCard extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private cardData: Card | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'card-slide-enter',
        enterActive: 'card-slide-enter-active',
        exit: 'card-slide-exit',
        exitActive: 'card-slide-exit-active'
    };

    protected parseData(dataString: string): void {
        try {
            this.cardData = JSON.parse(dataString) as Card;
        } catch (e) {
            console.error("UiCard: Failed to parse data attribute:", e);
            this.cardData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.cardData !== null;
    }

    protected renderContent(): void {
        this.shadow.innerHTML = `
        <style>
            :host { display: block; }
            .card {
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            h3 {
                margin-top: 0;
                margin-bottom: 10px;
            }
            .card-content {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .child-wrapper {
                display: block;
            }
        </style>
        <div class="card">
            <h3>${this.cardData?.title || ''}</h3>
            <div class="card-content"></div>
        </div>
    `;

        const { children } = this.cardData ?? {};
        if (Array.isArray(children) && children.length > 0) {
            const contentContainer = this.shadow.querySelector('.card-content');
            if (contentContainer) {
                for (const child of children) {
                    const wrapper = document.createElement("div");
                    wrapper.classList.add("child-wrapper");

                    applyLayoutMeta(wrapper, child.layout);

                    contentContainer.appendChild(wrapper);
                    this.registry.getInterpreter().render(wrapper, child);
                }
            }
        }
    }
}
