import type {Text, TransitionConfig} from '../schema.ts';
import { BaseUiComponent } from './BaseUiComponent';

export class UiText extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private textData: Text | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'text-enter',
        enterActive: 'text-enter-active',
        exit: 'text-exit',
        exitActive: 'text-exit-active'
    };

    protected parseData(dataString: string): void {
        try {
            this.textData = JSON.parse(dataString) as Text;
        } catch (e) {
            console.error("UiText: Failed to parse data attribute:", e);
            this.textData = null;
        }
    }

    protected hasParsedData(): boolean { return this.textData !== null; }

    protected renderContent(): void {
        const textContent = this.textData?.text || '';
        const variant = this.textData?.variant || 'body';

        this.shadow.innerHTML = `
            <style>
                :host { display: block; }
                .h1 { font-size: 2em; margin: 0.67em 0; }
                .h2 { font-size: 1.5em; margin: 0.83em 0; }
                .h3 { font-size: 1.17em; margin: 1em 0; }
                .body { font-size: 1em; line-height: 1.5; }
                .caption { font-size: 0.8em; color: #555; }
                .highlight-info { background-color: #e0f7fa; color: #00796b; padding: 2px 5px; border-radius: 4px; }
                .highlight-warning { background-color: #fff3e0; color: #f57c00; padding: 2px 5px; border-radius: 4px; }
                .highlight-error { background-color: #ffebee; color: #d32f2f; padding: 2px 5px; border-radius: 4px; }
                .highlight-success { background-color: #e8f5e9; color: #388e3c; padding: 2px 5px; border-radius: 4px; }
                .highlight-accent { background-color: #e3f2fd; color: #1976d2; padding: 2px 5px; border-radius: 4px; }
            </style>
            <span class="${variant}">${textContent}</span>
        `;
    }
}
