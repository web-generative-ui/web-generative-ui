import type {Children, Component, Patch, TransitionConfig} from '../schema.ts';
import {componentTagMap} from "./ComponentMapping.ts";
import type {Registry} from "./Registry.ts";
import type {Envelope} from "./transport/types.ts";

/**
 * Read metadata
 */
function readElementKey(el: Element | null): string | undefined {
    if (!el) return undefined;
    return (el as HTMLElement).dataset['componentKey'];
}
function readElementType(el: Element | null): string | undefined {
    if (!el) return undefined;
    return (el as HTMLElement).dataset['componentType'];
}

async function removeElementGracefully(el: Element) {
    // if the element is a custom element instance with willExit, call it
    const maybeComp = el as unknown as { willExit?: () => Promise<void> };
    if (typeof maybeComp.willExit === 'function') {
        try {
            await maybeComp.willExit();
        } catch {
            // swallow; proceed to remove
        }
    }
    if (el.parentElement) el.parentElement.removeChild(el);
}

/**
 * The Interpreter class is responsible for rendering and applying patches to the UI.
 * It handles the dynamic creation and update of custom elements based on the provided data.
 */
export class Interpreter {
    private registry: Registry;

    constructor(registry: Registry) {
        this.registry = registry;
    }

    /**
     * A helper function that can find an element by its ID,
     * traversing through Shadow DOM boundaries.
     */
    private findElementById(root: Document | HTMLElement | ShadowRoot, id: string): HTMLElement | null {
        const found = root.querySelector(`#${id}`);
        if (found) {
            return found as HTMLElement;
        }

        const elements = root.querySelectorAll('*');
        for (const element of elements) {
            if (element.shadowRoot) {
                const foundInShadow = this.findElementById(element.shadowRoot, id);
                if (foundInShadow) {
                    return foundInShadow;
                }
            }
        }

        return null;
    }

    /**
     * Creates a custom element for given component data.
     * @param componentData The component data to create the element for.
     * @returns A Promise that resolves to the created custom element.
     */
    private async createComponentElement(componentData: Component): Promise<HTMLElement | null> {
        await this.registry.ensureComponentDefined(componentData.component);
        // await this.registry.ensurePayloadComponentsDefined(componentData)

        const tagName = componentTagMap[componentData.component as string];
        if (!tagName) {
            console.error(`Error: Cannot create element for '${componentData.component}' because no tag mapping exists.`);
            return null;
        }

        const customElement = document.createElement(tagName);
        if (componentData.id) {
            customElement.id = componentData.id;
        }
        customElement.setAttribute('data', JSON.stringify(componentData));
        return customElement;
    }

    private getTransitionConfig(element: HTMLElement): TransitionConfig {
        const componentClass = element.constructor as any;
        const customConfig: Partial<TransitionConfig> = componentClass.transitionConfig || {};

        return {
            enter: customConfig.enter || 'g-enter',
            enterActive: customConfig.enterActive || 'g-enter-active',
            exit: customConfig.exit || 'g-exit',
            exitActive: customConfig.exitActive || 'g-exit-active',
            update: customConfig.update || 'g-highlight',
            highlight: customConfig.highlight || 'g-highlight',
        };
    }

    /**
     * Animates the addition or removal of an element.
     * @param element The element to animate.
     */
    private animateUpdate(element: HTMLElement) {
        const config = this.getTransitionConfig(element);

        // For updates, temporary adds a highlight class
        element.classList.add(config.update);
        element.addEventListener('animationend', () => {
            element.classList.remove(config.update);
        }, { once: true });
    }

    /**
     * High-level reconciler render.
     * Reuses DOM nodes when comp.key matches existing element's data-component-key.
     * For components without a key, falls back to index-based reuse.
     * @param targetElement The target element to render the components to.
     * @param components The component or list of components to render.
     * @returns A Promise that resolves when the components are rendered.
     */
    public async render(targetElement: Element | HTMLElement | ShadowRoot, components: Component | Children | undefined): Promise<void> {
        // Normalize the input to always be an array of components
        if (!components) {
            // If the desired state is empty, remove all existing children
            for (const child of Array.from(targetElement.children)) {
                await removeElementGracefully(child);
            }
            return;
        }
        const desired: Component[] = Array.isArray(components) ? components : [components];

        // Create a stable copy of the existing DOM elements
        const existingEls = Array.from(targetElement.children) as HTMLElement[];

        // Build a map of existing elements that have a 'componentKey' for quick lookups
        const keyedMap = new Map<string, HTMLElement>();
        existingEls.forEach(el => {
            const key = readElementKey(el);
            if (key) {
                keyedMap.set(key, el);
            }
        });

        // A set to keep track of elements that are kept, so we can remove the rest
        const consumed = new Set<Element>();

        // --- Main Reconciliation Loop ---
        // Iterate through the desired components and place them in the correct order
        for (let i = 0; i < desired.length; i++) {
            const comp = desired[i];
            const compKey = comp.key ?? null;
            let reuseEl: HTMLElement | undefined;

            // 1. Find a DOM element to reuse
            if (compKey) {
                // If the desired component has a key, try to find a match in our map
                reuseEl = keyedMap.get(compKey);
            } else {
                // For un-keyed components, attempt to reuse the element at the same index
                const candidate = existingEls[i];
                // Only reuse if the candidate is also un-keyed and has the same component type
                if (candidate && !readElementKey(candidate) && readElementType(candidate) === comp.component) {
                    reuseEl = candidate;
                }
            }

            // If we found a potential element to reuse, we must verify its type hasn't changed
            if (reuseEl && readElementType(reuseEl) !== comp.component) {
                reuseEl = undefined; // Do not reuse if component type is different
            }

            let elToPlace: HTMLElement | null;

            // 2. Create or Update the element
            if (reuseEl) {
                // If we are reusing an element, mark it as consumed
                consumed.add(reuseEl);
                elToPlace = reuseEl;
                // Update its data, which will trigger its 'attributeChangedCallback'
                elToPlace.setAttribute('data', JSON.stringify(comp));
                // Trigger a highlight animation to give visual feedback on the update
                queueMicrotask(() => this.animateUpdate(elToPlace as HTMLElement));
            } else {
                // If no element could be reused, create a new one
                const created = await this.createComponentElement(comp);
                elToPlace = created;
            }

            if (!elToPlace) {
                continue; // Skip if element creation failed
            }

            // 3. Place the element in the correct DOM position
            const currentElAtIndex = targetElement.children[i] as HTMLElement | undefined;
            if (currentElAtIndex !== elToPlace) {
                // If the element is not already in the correct spot, insert it.
                // 'insertBefore' with a null reference node will append it to the end.
                targetElement.insertBefore(elToPlace, currentElAtIndex ?? null);
            }
        }

        // --- Cleanup Phase ---
        // Remove any old elements that were not part of the 'consumed' set
        for (const el of existingEls) {
            if (!consumed.has(el)) {
                // Use the graceful removal function to allow for exit animations
                await removeElementGracefully(el);
            }
        }
    }

    /**
     * Applies a patch to a root element.
     * @param rootElement The root element to apply the patch to.
     * @param patch The patch to apply.
     * @returns A Promise that resolves when the patch is applied.
     */
    public async applyPatch(rootElement: HTMLElement | ShadowRoot, patch: Patch): Promise<void> {
        // existing implementation unchanged
        switch (patch.op) {
            case 'add': {
                const newElement = await this.createComponentElement(patch.value);
                if (!newElement) return;

                let parentElement: Element | HTMLElement | ShadowRoot = rootElement;
                if (patch.path) {
                    const parent = this.findElementById(rootElement, patch.path);
                    if (parent && parent.shadowRoot) {
                        parentElement = parent.shadowRoot.querySelector('.card-content') || parent.shadowRoot;
                    } else if (parent) {
                        parentElement = parent;
                    }
                }

                parentElement.appendChild(newElement);
                break;
            }

            case 'update': {
                if (!patch.targetId || !patch.value) return;
                const elementToUpdate = this.findElementById(rootElement, patch.targetId);

                if (elementToUpdate) {
                    elementToUpdate.setAttribute('data', JSON.stringify(patch.value));
                    queueMicrotask(() => {
                        this.animateUpdate(elementToUpdate);
                    });
                } else {
                    console.warn(`Element with ID '${patch.targetId}' not found for 'update' operation.`);
                }
                break;
            }

            case 'remove': {
                if (!patch.targetId) return;
                const elementToRemove = this.findElementById(rootElement, patch.targetId);
                if (elementToRemove) {
                    if (elementToRemove) {
                        await removeElementGracefully(elementToRemove);
                    }
                } else {
                    console.warn(`Element with ID '${patch.targetId}' not found for 'remove' operation.`);
                }
                break;
            }
        }
    }

    /**
     * Handle a transport Envelope and delegate to the proper interpreter operation.
     * @param rootElement Root to operate on.
     * @param envelope Transport envelope.
     */
    public async handleEnvelope(rootElement: HTMLElement | ShadowRoot, envelope: Envelope): Promise<void> {
        if (!envelope) return;

        try {
            switch (envelope.type) {
                case 'patch':
                    if (envelope.payload) {
                        await this.applyPatch(rootElement, envelope.payload);
                    }
                    break;

                case 'message':
                    // Treat message payload as renderable components or children
                    // If payload is undefined or unrecognized, do nothing
                    if (envelope.payload) {
                        await this.render(rootElement as any, envelope.payload);
                    }
                    break;

                case 'control':
                    // Simple control handling: if control carries a patch, apply it
                    if (envelope.payload?.patch) {
                        await this.applyPatch(rootElement, envelope.payload.patch);
                    }
                    // Additional control actions can be implemented here
                    break;

                default:
                    console.warn('Unknown envelope type:', envelope.type);
            }
        } catch (err) {
            console.error('Error handling envelope:', err, envelope);
        }
    }
}
