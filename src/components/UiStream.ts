import { BaseUiComponent } from "./BaseUiComponent.ts";
import type { Stream, TransitionConfig } from "../schema.ts";

/**
 * UiStream - renders streaming conversational items.
 * - Reconciles items by key/id
 * - Applies per-item enter/exit classes using this.constructor.transitionConfig
 * - Renders nested component content via registry.interpreter
 */
export class UiStream extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private streamData: Stream | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'stream-item-enter',
        enterActive: 'stream-item-enter-active',
        exit: 'stream-item-exit',
        exitActive: 'stream-item-exit-active'
    };

    protected parseData(data: string): void {
        // permissive parse: accept structure that "looks like" a Stream
        try {
            const parsed = JSON.parse(data);
            // do minimal sanity check, but don't throw for minor differences
            if (parsed && parsed.component === 'stream' && Array.isArray(parsed.items)) {
                this.streamData = parsed as Stream;
            } else if (parsed && Array.isArray(parsed.items)) {
                // tolerate payload without explicit component field
                this.streamData = parsed as Stream;
            } else {
                // fallback: try to coerce
                this.streamData = parsed as Stream;
            }
        } catch (e) {
            console.error("UiStream parseData error:", e);
            this.streamData = null;
        }
        // we don't call renderContent here — connectedCallback / attributeChangedCallback will.
    }

    protected hasParsedData(): boolean {
        return this.streamData !== null;
    }

    protected renderContent(): void {
        // keep outer function synchronous, but perform async work inside
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color: red;">Invalid or missing stream data</span>`;
            return;
        }

        // capture current data
        const stream = this.streamData!;
        const { direction = 'down', items = [] } = stream;

        // initial shell
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
                .author { font-weight: bold; }
                .status { font-size: 0.75em; margin-left: 0.5em; }
                .status.pending { color: #999; }
                .status.completed { color: #4caf50; }
                .status.error { color: #e53935; }
                .content { margin-top: 0.25em; }
            </style>
            <div class="stream ${direction}"></div>
        `;

        // async worker: preload nested component types and then reconcile/render items
        (async () => {
            const streamContainer = this.shadow.querySelector('.stream') as HTMLElement;
            if (!streamContainer) return;

            // Preload nested component definitions used in item.content (best-effort, non-blocking)
            try {
                const nestedComponents: any[] = [];
                for (const it of items) {
                    const c = it.content;
                    if (c && typeof c === 'object') {
                        // support single component or array container
                        if (Array.isArray(c)) nestedComponents.push(...c);
                        else nestedComponents.push(c);
                    }
                }
                if (nestedComponents.length > 0) {
                    // don't await too long here; ensure definitions in background
                    this.registry.ensurePayloadComponentsDefined(nestedComponents).catch(() => {});
                }
            } catch {
                // noop
            }

            // Reconciliation: reuse existing item DOM nodes when key/id matches
            const existingEls = Array.from(streamContainer.querySelectorAll('.item')) as HTMLElement[];
            const keyed = new Map<string, HTMLElement>();
            existingEls.forEach(el => {
                const k = el.dataset['streamKey'];
                if (k) keyed.set(k, el);
            });
            const consumed = new Set<HTMLElement>();

            // helper: read transition class names from class's transitionConfig
            const cfg = (this.constructor as typeof UiStream).transitionConfig ?? {};
            const enterCls = cfg.enter;
            const enterActive = cfg.enterActive ?? `${enterCls}-active`;
            const exitCls = cfg.exit;
            const exitActive = cfg.exitActive ?? `${exitCls}-active`;

            // helper: create item element
            const createItemEl = (item: Stream['items'][number], _index: number) => {
                const el = document.createElement('div');
                el.className = 'item';
                const key = item.key ?? item.id ?? String(_index);
                el.dataset['streamKey'] = key;

                // header
                const header = document.createElement('div');
                header.className = 'header';
                const left = document.createElement('span');
                left.className = 'author';
                left.textContent = item.author ?? '';
                const right = document.createElement('span');
                // right can contain timestamp + status
                right.innerHTML = `${item.timestamp ?? ''} ${item.status ? `<span class="status ${item.status}">${item.status}</span>` : ''}`;

                header.appendChild(left);
                header.appendChild(right);

                // content container
                const content = document.createElement('div');
                content.className = 'content';

                el.appendChild(header);
                el.appendChild(content);

                // animate enter (if classes defined)
                if (enterCls) {
                    el.classList.add(enterCls);
                    // next frame apply active to trigger transition
                    requestAnimationFrame(() => {
                        el.classList.add(enterActive);
                        el.classList.remove(enterCls);
                    });
                    // cleanup after transition end (best-effort)
                    const onEnd = (ev: TransitionEvent) => {
                        if (ev.target !== el) return;
                        el.classList.remove(enterActive);
                        el.removeEventListener('transitionend', onEnd);
                    };
                    el.addEventListener('transitionend', onEnd);
                }

                return el;
            };

            // helper: graceful remove for item DOM nodes (uses exit classes and waits)
            const removeItemGracefully = (el: HTMLElement) => {
                return new Promise<void>((resolve) => {
                    if (!exitCls) {
                        if (el.parentElement) el.parentElement.removeChild(el);
                        resolve();
                        return;
                    }

                    // remove any enter classes that may conflict
                    if (enterCls != null) {
                        el.classList.remove(enterCls);
                    }
                    el.classList.remove(enterActive);

                    el.classList.add(exitCls);
                    requestAnimationFrame(() => {
                        el.classList.add(exitActive);
                        el.classList.remove(exitCls);
                    });

                    const timeout = setTimeout(() => {
                        if (el.parentElement) el.parentElement.removeChild(el);
                        resolve();
                    }, 800);

                    const onEnd = (ev: TransitionEvent) => {
                        if (ev.target !== el) return;
                        clearTimeout(timeout);
                        el.classList.remove(exitActive);
                        el.removeEventListener('transitionend', onEnd);
                        if (el.parentElement) el.parentElement.removeChild(el);
                        resolve();
                    };
                    el.addEventListener('transitionend', onEnd);
                });
            };

            // Build / reuse elements in order
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const key = item.key ?? item.id ?? String(i);

                let reuseEl: HTMLElement | undefined = keyed.get(key);

                // If reuseEl exists but is already consumed, don't reuse (duplicate keys)
                if (reuseEl && consumed.has(reuseEl)) reuseEl = undefined;

                let elToPlace: HTMLElement;
                if (reuseEl) {
                    consumed.add(reuseEl);
                    elToPlace = reuseEl;
                    // Update header fields if changed
                    const authorEl = elToPlace.querySelector('.author') as HTMLElement | null;
                    if (authorEl) authorEl.textContent = item.author ?? '';
                    const rightEl = elToPlace.querySelector('.header > span:nth-child(2)') as HTMLElement | null;
                    if (rightEl) rightEl.innerHTML = `${item.timestamp ?? ''} ${item.status ? `<span class="status ${item.status}">${item.status}</span>` : ''}`;

                    // update content via interpreter (reconcile within content)
                    const contentEl = elToPlace.querySelector('.content') as HTMLElement;
                    if (contentEl) {
                        if (typeof item.content === 'string') {
                            // clear and set text
                            contentEl.textContent = item.content;
                        } else {
                            // render component/content; interpreter will reconcile inside contentEl
                            try {
                                await this.registry.ensurePayloadComponentsDefined(item.content as any);
                            } catch { /* noop */ }
                            await this.registry.getInterpreter().render(contentEl, item.content as any);
                        }
                    }
                } else {
                    // create new element
                    elToPlace = createItemEl(item, i);

                    // render content
                    const contentEl = elToPlace.querySelector('.content') as HTMLElement;
                    if (contentEl) {
                        if (typeof item.content === 'string') {
                            contentEl.textContent = item.content;
                        } else {
                            try {
                                await this.registry.ensurePayloadComponentsDefined(item.content as any);
                            } catch { /* continue */ }
                            await this.registry.getInterpreter().render(contentEl, item.content as any);
                        }
                    }
                }

                // insert at correct index
                const currentAtIndex = streamContainer.children[i] as Element | undefined;
                if (currentAtIndex === elToPlace) {
                    // already in right place
                } else {
                    const referenceNode = streamContainer.children[i] ?? null;
                    streamContainer.insertBefore(elToPlace, referenceNode);
                }
            }

            // remove any leftover existing elements not consumed
            const removals: Promise<void>[] = [];
            for (const el of existingEls) {
                if (!consumed.has(el)) {
                    removals.push(removeItemGracefully(el));
                }
            }
            // run removals concurrently
            if (removals.length > 0) await Promise.all(removals);
        })();
    }
}
