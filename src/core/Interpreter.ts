import type {Children, Component, Patch, TransitionConfig} from '../schema.d.ts';
import {componentTagMap} from "./ComponentMapping.ts";
import type {Registry} from "./Registry.ts";
import type {Envelope} from "./transport/types.ts";

/**
 * Reads the unique component key from a given HTML element's `data-component-key` attribute.
 * This key is used for efficient DOM reconciliation.
 * @param element The HTML element to inspect.
 * @returns The component key string, or `undefined` if not found or if the element is null.
 */
function readElementKey(element: Element | null): string | undefined {
    if (!element) return undefined;
    return (element as HTMLElement).dataset['componentKey'];
}

/**
 * Reads the component type from a given HTML element's `data-component-type` attribute.
 * This type typically corresponds to the `component` field in the UI schema (e.g., 'card', 'text').
 * @param element The HTML element to inspect.
 * @returns The component type string, or `undefined` if not found or if the element is null.
 */
function readElementType(element: Element | null): string | undefined {
    if (!element) return undefined;
    return (element as HTMLElement).dataset['componentType'];
}

/**
 * Gracefully removes an HTML element from the DOM.
 * If the element is a custom element instance and implements a `willExit()` method,
 * that method will be awaited to allow for custom exit animations or cleanup logic before removal.
 * Any errors during `willExit()` execution are swallowed, and the element is still removed.
 * @param element The HTML element to remove.
 * @returns A promise that resolves once the element has been removed or its `willExit` method completes.
 */
async function removeElementGracefully(element: Element) {
    const componentInstance = element as unknown as { willExit?: () => Promise<void> };

    if (typeof componentInstance.willExit === 'function') {
        try {
            await componentInstance.willExit();
        } catch {
            // swallow; proceed to remove regardless of willExit's success
        }
    }
    element.parentElement?.removeChild(element);
}
/**
 * The Interpreter class is responsible for dynamically rendering UI components,
 * applying updates via patches, and reconciling the DOM based on a declarative schema.
 * It acts as the core engine for turning data into interactive UI elements.
 */
export class Interpreter {
    /**
     * An instance of the Registry, used to ensure that required UI components are loaded
     * and defined as custom elements before they are instantiated.
     * @private
     */
    private registry: Registry;

    /**
     * Creates an instance of the Interpreter.
     * @param registry The Registry instance used to manage component loading and definition.
     */
    constructor(registry: Registry) {
        this.registry = registry;
    }

    /**
     * A helper function that searches for an HTML element by its ID within a given root.
     * This function is capable of traversing through Shadow DOM boundaries recursively.
     *
     * @param root The starting point for the search (Document, HTMLElement, or ShadowRoot).
     * @param id The HTML `id` attribute value of the element to find.
     * @returns The found HTMLElement, or `null` if no element with the given ID is found after traversing.
     * @private
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
     * Creates a new custom HTML element based on the provided component data.
     * It ensures the component's custom element definition is loaded via the Registry
     * before instantiating the element. The element's `data` attribute is populated
     * with the stringified component data, and its `id` is set if provided.
     *
     * @param desiredComponent The component data (schema) used to create the element.
     * @returns A Promise that resolves to the newly created custom HTMLElement, or `null` if the component's tag mapping is missing or creation fails.
     * @private
     */
    private async createComponentElement(desiredComponent: Component | undefined): Promise<HTMLElement | null> {
        if (!desiredComponent || !desiredComponent.component) {
            console.error('Error: Cannot create element because the component data is missing or invalid.');
            return null;
        }

        await this.registry.ensureComponentDefined(desiredComponent.component);
        await this.registry.ensurePayloadComponentsDefined(desiredComponent)

        const tagName = componentTagMap[desiredComponent.component as string];
        if (!tagName) {
            console.error(`Error: Cannot create element for '${desiredComponent.component}' because no tag mapping exists.`);
            return null;
        }

        const newCustomElement = document.createElement(tagName);
        if (desiredComponent.id) {
            newCustomElement.id = desiredComponent.id;
        }

        newCustomElement.setAttribute('data', JSON.stringify(desiredComponent));
        return newCustomElement;
    }

    /**
     * Retrieves the transition configuration for a given custom element.
     * This configuration defines CSS class names used for various transition states (enter, exit, update, highlight).
     * It checks for a `transitionConfig` static property on the component's class, falling back to default values.
     *
     * @param element The HTMLElement for which to get the transition configuration.
     * @returns A `TransitionConfig` object containing CSS class names for different animation phases.
     * @private
     */
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
     * Applies a temporary highlight animation to an element to visually indicate an update.
     * It adds an 'update' CSS class (from the component's transition config) and removes it
     * after the animation concludes.
     *
     * @param element The HTMLElement to animate.
     * @private
     */
    private animateUpdate(element: HTMLElement) {
        const transitionConfig = this.getTransitionConfig(element);
        element.classList.add(transitionConfig.update);
        element.addEventListener('animationend', () => {
            element.classList.remove(transitionConfig.update);
        }, { once: true });
    }

    /**
     * Determines which existing DOM element, if any, can be reused for a desired component.
     * Prioritizes key-based reuse, then index-based reuse for unkeyed parts of the same type.
     * @private
     * @param desiredComponent The component schema to find a match for.
     * @param index The current index in the desired components list.
     * @param existingElements An array of currently rendered DOM elements.
     * @param keyedMap A map of existing keyed elements for quick lookup.
     * @returns An HTMLElement that can be reused, or `undefined` if no suitable element is found.
     */
    private _findReusableElement(
        desiredComponent: Component,
        index: number,
        existingElements: HTMLElement[],
        keyedMap: Map<string, HTMLElement>
    ): HTMLElement | undefined {
        const desiredComponentKey = desiredComponent.key ?? null;
        let reusableElement: HTMLElement | undefined;

        if (desiredComponentKey) {
            reusableElement = keyedMap.get(desiredComponentKey);
        } else {
            // For unkeyed components, attempt to reuse the element at the same index
            const candidate = existingElements[index];
            if (candidate && !readElementKey(candidate) && readElementType(candidate) === desiredComponent.component) {
                reusableElement = candidate;
            }
        }

        // Final check: if we found an element, ensure its type hasn't changed
        if (reusableElement && readElementType(reusableElement) !== desiredComponent.component) {
            reusableElement = undefined; // Cannot reuse if the component type is different
        }
        return reusableElement;
    }

    /**
     * Creates a new element or updates an existing one based on the desired component data.
     * @private
     * @param desiredComponent The component schema.
     * @param existingElementToReuse An optional existing element to update.
     * @param consumed A set to track elements that have been reused.
     * @returns A promise is resolving to the final HTMLElement to place, or null if creation failed.
     */
    private async _createOrUpdateElement(
        desiredComponent: Component,
        existingElementToReuse: HTMLElement | undefined,
        consumed: Set<Element>
    ): Promise<HTMLElement | null> {
        let finalElementToPlace: HTMLElement | null;

        if (existingElementToReuse) {
            consumed.add(existingElementToReuse);
            finalElementToPlace = existingElementToReuse;
            finalElementToPlace.setAttribute('data', JSON.stringify(desiredComponent));
            queueMicrotask(() => this.animateUpdate(finalElementToPlace as HTMLElement));
        } else {
            finalElementToPlace = await this.createComponentElement(desiredComponent);
        }
        return finalElementToPlace;
    }

    /**
     * Places an element into the correct DOM position within the target parent.
     * @private
     * @param targetParent The parent element/ShadowRoot.
     * @param elementToPlace The element to position.
     * @param index The desired index for the element.
     */
    private _placeElement(
        targetParent: Element | HTMLElement | ShadowRoot,
        elementToPlace: HTMLElement,
        index: number
    ): void {
        const currentElementAtIndex = targetParent.children[index] as HTMLElement | undefined;
        if (currentElementAtIndex !== elementToPlace) {
            targetParent.insertBefore(elementToPlace, currentElementAtIndex ?? null);
        }
    }

    /**
     * Performs high-level DOM reconciliation, rendering a desired set of components into a target element.
     * This method efficiently updates the DOM by reusing existing elements where possible, based on
     * a component's `key` property (for stable element identity) or by index and component type.
     *
     * Elements with matching keys are updated, unkeyed elements are reused by index if their type matches,
     * new elements are created, and old, unneeded elements are gracefully removed.
     *
     * @param targetElement The DOM element or ShadowRoot where the components should be rendered.
     * @param components The desired component(s) to render. Can be a single `Component` object,
     *                   an array of `Children` (Components), or `undefined` to clear the target.
     * @returns A Promise that resolves to `void` when the reconciliation and rendering process is complete.
     */
    public async render(targetElement: Element | HTMLElement | ShadowRoot, components: Component | Children | undefined): Promise<void> {
        // If the desired state is empty or undefined, remove all existing children.
        if (!components) {
            for (const child of Array.from(targetElement.children)) {
                await removeElementGracefully(child);
            }
            return;
        }
        const desiredComponents: Component[] = Array.isArray(components) ? components : [components];

        const existingElements = Array.from(targetElement.children) as HTMLElement[];

        // Build a map of existing elements that have a 'componentKey' for quick lookups
        const keyedMap = new Map<string, HTMLElement>();
        existingElements.forEach(element => {
            const key = readElementKey(element);
            if (key) {
                keyedMap.set(key, element);
            }
        });

        // A set to keep track of elements that are kept or reused, so unconsumed ones can be removed later
        const consumed = new Set<Element>();

        // Iterate through the desired components and place them in the correct order
        for (let i = 0; i < desiredComponents.length; i++) {
            const desiredComponent = desiredComponents[i];

            // 1. Find a DOM element to reuse
            const existingElementToReuse = this._findReusableElement(
                desiredComponent,
                i,
                existingElements,
                keyedMap
            );

            // 2. Create or Update the element
            const finalElementToPlace = await this._createOrUpdateElement(
                desiredComponent,
                existingElementToReuse,
                consumed
            );

            if (!finalElementToPlace) {
                continue; // Skip if element creation failed
            }

            // 3. Place the element in the correct DOM position
            this._placeElement(targetElement, finalElementToPlace, i);
        }

        // Remove any old elements that were not part of the 'consumed' set
        for (const element of existingElements) {
            if (!consumed.has(element)) {
                // Use the graceful removal function to allow for exit animations
                await removeElementGracefully(element);
            }
        }
    }

    /**
     * Applies a structural patch to a root element, allowing for dynamic additions, updates, or removals
     * of UI components. This method directly manipulates the DOM based on the specified patch operation.
     *
     * @param rootElement The root HTMLElement or ShadowRoot to which the patch should be applied.
     * @param patch The `Patch` object describing the operation (add, update, remove), target, and value.
     * @returns A Promise that resolves to `void` when the patch has been applied.
     */
    public async applyPatch(rootElement: HTMLElement | ShadowRoot, patch: Patch): Promise<void> {
        switch (patch.op) {
            case 'add': {
                const newElement = await this.createComponentElement(patch.value);
                if (!newElement) return;

                let parentElement: Element | HTMLElement | ShadowRoot = rootElement;
                if (patch.path) {
                    const foundParent = this.findElementById(rootElement, patch.path);
                    if (foundParent) {
                        parentElement = foundParent.shadowRoot?.querySelector('.card-content') || foundParent.shadowRoot || foundParent;
                    }
                }

                if (parentElement instanceof Element || parentElement instanceof HTMLElement || parentElement instanceof ShadowRoot) {
                    parentElement.appendChild(newElement);
                } else {
                    console.warn(`Could not determine valid parent element for 'add' operation at path '${patch.path}'.`);
                }
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
     * Handles a transport `Envelope` received from an external source (e.g., a backend service).
     * This method dispatches the envelope's payload to the appropriate interpreter operation
     * (e.g., `applyPatch` for 'patch' types, `render` for 'message' types).
     *
     * Errors during envelope processing are caught and logged, preventing application crashes.
     *
     * @param rootElement The HTMLElement or ShadowRoot on which the envelope operations should be performed.
     * @param envelope The `Envelope` object containing the type of operation and its payload.
     * @returns A Promise that resolves to `void` once the envelope has been processed.
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
                    if (envelope.payload) {
                        await this.render(rootElement as any, envelope.payload);
                    }
                    break;

                case 'control':
                    // Simple control handling: if control carries a patch, apply it
                    if (envelope.payload?.patch) {
                        await this.applyPatch(rootElement, envelope.payload.patch);
                    }
                    // Additional control actions can be implemented here based on `envelope.payload.action` or other fields
                    break;

                default:
                    console.warn('Unknown envelope type:', envelope.type);
            }
        } catch (err) {
            console.error('Error handling envelope:', err, envelope);
        }
    }
}
