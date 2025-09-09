import type { Registry } from "../core/Registry.ts";
import type { TransitionConfig } from "../schema.ts";
import type { Children } from "../schema.ts";

/**
 * Base class for UI components.
 *
 * Responsibilities added:
 *  - automatic metadata extraction from `data` attribute (key/layout)
 *  - stamp DOM dataset for reconciliation
 *  - enter/exit transition helpers based on `transitionConfig`
 *  - helper to render normalized children via the registry
 */
export abstract class BaseUiComponent extends HTMLElement {
    protected abstract shadow: ShadowRoot;
    protected readonly registry: Registry;

    private static _registry: Registry | null = null;

    /** Per-class transition config. Subclasses may override. */
    public static transitionConfig: Partial<TransitionConfig> = {};

    /** The parsed raw data string (if available). Subclasses still implement parseData to set internal shape. */
    protected rawDataString?: string;

    /** Extracted key/layout (populated from parsed `data` JSON when present). */
    protected componentKey?: string;
    protected componentLayout?: Record<string, unknown> | undefined;

    public static setRegistry(registry: Registry): void {
        // fixed stray character and made idempotent
        BaseUiComponent._registry = registry;
    }

    protected constructor() {
        super();
        if (BaseUiComponent._registry === null) {
            throw new Error("Registry has not been set for BaseUiComponent. Call BaseUiComponent.setRegistry() first.");
        }
        this.registry = BaseUiComponent._registry;
    }

    /* ---------- attributes lifecycle ---------- */

    static get observedAttributes(): string[] {
        return ['data'];
    }

    protected abstract parseData(data: string): void;
    protected abstract renderContent(): void;
    protected abstract hasParsedData(): boolean;

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'data' && oldValue !== newValue) {
            // keep raw string for metadata extraction
            this.rawDataString = newValue ?? '{}';
            // subclass will parse and set its internal state
            this.parseData(this.rawDataString);
            // extract lightweight metadata (key/layout) from the raw string for reconciliation
            this.updateMetadataFromDataString(this.rawDataString);
            this.renderContent();
        }
    }

    connectedCallback(): void {
        // ensure shadow exists
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });

        // initial parse if attribute present but parseData not yet called
        if (!this.hasParsedData() && this.hasAttribute('data')) {
            const ds = this.getAttribute('data') ?? '{}';
            this.rawDataString = ds;
            this.parseData(ds);
            this.updateMetadataFromDataString(ds);
        }

        // render the component content
        this.renderContent();

        // stamp metadata to host for reconciler
        this.stampMetadataToHost();

        // run enter transition if defined
        this.applyEnterTransition();
    }

    disconnectedCallback(): void {
        // no-op here; the renderer should call willExit() prior to removing DOM when graceful exit required.
    }

    /* ---------- metadata helpers ---------- */

    /**
     * Try to extract { key, layout } from JSON data string.
     * This is designed to be tolerant of legacy payloads.
     */
    protected updateMetadataFromDataString(dataString?: string): void {
        if (!dataString) return;
        try {
            const parsed = JSON.parse(dataString);
            if (parsed?.key && typeof parsed.key === 'string') this.componentKey = parsed.key;
            if (parsed?.layout && typeof parsed.layout === 'object') this.componentLayout = parsed.layout;
        } catch {
            // ignore parse errors; do not throw here
        }
    }

    /**
     * Write metadata to host element dataset. Used by reconciler to detect keys/types.
     */
    protected stampMetadataToHost(): void {
        const host = this as HTMLElement;
        host.dataset['componentType'] = (this.constructor as any).name ?? host.tagName.toLowerCase();
        if (this.componentKey) host.dataset['componentKey'] = this.componentKey;
        else delete host.dataset['componentKey'];

        if (this.componentLayout) {
            try {
                host.dataset['componentLayout'] = JSON.stringify(this.componentLayout);
            } catch {
                delete host.dataset['componentLayout'];
            }
        } else {
            delete host.dataset['componentLayout'];
        }
    }

    /**
     * Convenience for container components: render children into a container using the registry's interpreter.
     * Normalizes `children` if `undefined` harmlessly.
     */
    protected async renderChildrenInto(container: Element | HTMLElement | ShadowRoot, children?: Children): Promise<void> {
        if (!children || children.length === 0) return;
        await this.registry.ensurePayloadComponentsDefined(children);
        await this.registry.getInterpreter().render(container, children);
    }

    /* ---------- transition helpers (enter/exit) ---------- */

    /**
     * Apply enter classes defined in the class's transitionConfig.
     * The implementation is tolerant: if no config exists, it is a no-op.
     */
    protected applyEnterTransition(): void {
        const ctor = this.constructor as typeof BaseUiComponent;
        const cfg = ctor.transitionConfig ?? {};
        const enter = cfg.enter;
        const enterActive = cfg.enterActive ?? `${enter}-active`;

        if (!enter) return;

        const host = this as HTMLElement;
        // Ensure we remove any lingering exit classes
        const exitCls = cfg.exit;
        const exitActiveCls = cfg.exitActive;
        if (exitCls) host.classList.remove(exitCls);
        if (exitActiveCls) host.classList.remove(exitActiveCls);

        // add enter, then on next frame add active to trigger transition
        host.classList.add(enter);
        // force layout + next frame
        requestAnimationFrame(() => {
            host.classList.add(enterActive);
            host.classList.remove(enter);
        });

        // cleanup once transition ends (best-effort)
        const onEnd = (ev: TransitionEvent) => {
            if (ev.target !== host) return;
            host.classList.remove(enterActive);
            host.removeEventListener('transitionend', onEnd);
        };
        host.addEventListener('transitionend', onEnd);
    }

    /**
     * Called by renderer before removing the element from DOM so exit animation can run.
     * Returns a Promise that resolves when the exit transition finishes (or immediately if none).
     */
    public willExit(): Promise<void> {
        const ctor = this.constructor as typeof BaseUiComponent;
        const cfg = ctor.transitionConfig ?? {};
        const exit = cfg.exit;
        const exitActive = cfg.exitActive ?? `${exit}-active`;

        if (!exit) return Promise.resolve();

        return new Promise((resolve) => {
            const host = this as HTMLElement;

            // remove any enter classes
            const enterCls = cfg.enter;
            const enterActive = cfg.enterActive;
            if (enterCls) host.classList.remove(enterCls);
            if (enterActive) host.classList.remove(enterActive);

            // add exit class and trigger active in next frame
            host.classList.add(exit);
            requestAnimationFrame(() => {
                host.classList.add(exitActive);
                host.classList.remove(exit);
            });

            // set a safety timeout in case transitionend doesn't fire
            const timeout = setTimeout(() => {
                host.classList.remove(exitActive);
                resolve();
            }, 1000); // 1s safety (adjustable)

            const onEnd = (ev: TransitionEvent) => {
                if (ev.target !== host) return;
                clearTimeout(timeout);
                host.classList.remove(exitActive);
                host.removeEventListener('transitionend', onEnd);
                resolve();
            };

            host.addEventListener('transitionend', onEnd);
        });
    }
}
