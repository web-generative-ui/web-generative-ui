import type {Children, Component, Patch, TransitionConfig} from '../schema.ts';
import {componentTagMap} from "./ComponentMapping.ts";
import type {Registry} from "./Registry.ts";

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

        // Return a merged config with defaults
        return {
            enter: customConfig.enter || 'g-enter',
            enterActive: customConfig.enterActive || 'g-enter-active',
            exit: customConfig.exit || 'g-exit',
            exitActive: customConfig.exitActive || 'g-exit-active',
            update: customConfig.update || 'g-highlight',
        };
    }

    /**
     * Animates the addition of a new element.
     * @param element The element to animate.
     * @param parentElement The parent element to append the element to.
     */
    private animateAdd(element: HTMLElement, parentElement: Element | HTMLElement | ShadowRoot) {
        const config = this.getTransitionConfig(element);

        // 1. Start with the initial state
        element.classList.add(config.enter);
        parentElement.appendChild(element);

        // 2. In the next frame, transition to the active state
        requestAnimationFrame(() => {
            element.classList.add(config.enterActive);
        });

        // 3. Clean up the classes after the transition is done
        element.addEventListener('transitionend', () => {
            element.classList.remove(config.enter, config.enterActive);
        }, { once: true });
    }

    /**
     * Animates the removal of an element.
     * @param element The element to animate.
     */
    private animateRemove(element: HTMLElement) {
        const config = this.getTransitionConfig(element);

        // 1. Add the exit classes to trigger the animation
        element.classList.add(config.exit);
        requestAnimationFrame(() => { // Ensure styles are applied before active class
            element.classList.add(config.exitActive);
        });

        // 2. Wait for the animation to finish, then remove the element
        element.addEventListener('transitionend', () => {
            element.remove();
        }, { once: true });
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
     * Renders a component or a list of components to a target element.
     * @param targetElement The target element to render the components to.
     * @param components The component or list of components to render.
     * @returns A Promise that resolves when the components are rendered.
     */
    public async render(targetElement: Element | HTMLElement | ShadowRoot, components: Component | Children | undefined): Promise<void> {
        if (!components) return;
        const componentsToRender = Array.isArray(components) ? components : [components];

        for (const comp of componentsToRender) {
            const element = await this.createComponentElement(comp);
            if (element) {
                // may need to adjust for dynamic layout
                targetElement.appendChild(element);
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

                this.animateAdd(newElement, parentElement);
                break;
            }

            case 'update': {
                if (!patch.targetId || !patch.value) return;
                const elementToUpdate = this.findElementById(rootElement, patch.targetId);

                if (elementToUpdate) {
                    elementToUpdate.setAttribute('data', JSON.stringify(patch.value));
                    // Trigger the visual highlight after the component has re-rendered its data
                    // A microtask delay ensures the component's render cycle completes
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
                    this.animateRemove(elementToRemove);
                } else {
                    console.warn(`Element with ID '${patch.targetId}' not found for 'remove' operation.`);
                }
                break;
            }
        }
    }
}
