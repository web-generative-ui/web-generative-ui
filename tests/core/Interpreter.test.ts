import {describe, it, expect, beforeEach, vi} from 'vitest';
import {Registry} from "../../src/core/Registry";
import {Interpreter} from "../../src/core/Interpreter";
import type {Button, Card, Children, Component, Image, Patch, Text} from "../../backend/schema";
import type {Envelope} from "../../src/core/transport/types";

const customElementsDefineSpy = vi.spyOn(customElements, 'define');
vi.spyOn(console, 'error');
const consoleWarnSpy = vi.spyOn(console, 'warn');

class MockComponent extends HTMLElement {
    component = 'mock';
    title = '';
    text = '';
    label = '';
    setAttribute = vi.fn();
    getAttribute = vi.fn();
    appendChild = vi.fn();
    remove = vi.fn();
    querySelector = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
}

const mockHTMLElement = (tag: string, id?: string): HTMLElement => {
    const el = new MockComponent();
    Object.defineProperty(el, 'tagName', {value: tag.toUpperCase()});
    Object.defineProperty(el, 'id', {value: id});

    // A private array to simulate the children collection
    const _children: HTMLElement[] = [];
    Object.defineProperty(el, 'children', {
        get: () => _children,
        configurable: true,
    });

    // Override methods to interact with the private children array
    el.appendChild.mockImplementation((child: HTMLElement) => {
        _children.push(child);
        return child;
    });

    el.querySelector.mockImplementation((selector: string) => {
        const idMatch = selector.match(/^#(.+)/);
        if (idMatch) {
            return _children.find(c => c.id === idMatch[1]) || null;
        }
        return null;
    });

    return el;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(customElements, 'get').mockReturnValue(undefined);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => mockHTMLElement(tagName));
});

describe('Interpreter', () => {
    let registry: Registry;
    let interpreter: Interpreter;
    let container: HTMLElement;

    beforeEach(() => {
        registry = new Registry();
        interpreter = new Interpreter(registry);
        // We use our mock factory to create the container element
        container = mockHTMLElement('div', 'container');
        document.body.appendChild(container);

        // Mock registry to bypass actual file imports for interpreter tests
        vi.spyOn(registry, 'ensureComponentDefined').mockImplementation(async (componentName) => {
            // Return a mock component class for a given name
            // @ts-ignore
            componentTagMap[componentName] = `ui-${componentName}`;
            vi.spyOn(customElements, 'get').mockReturnValue(MockComponent as any);
            // @ts-ignore
            customElementsDefineSpy.mockImplementation(() => true);
        });

        // Mock the private `findElementById` to control search results
        // @ts-ignore
        vi.spyOn(interpreter, 'findElementById').mockImplementation((root: HTMLElement, id: string) => {
            return root.querySelector(`#${id}`);
        });
    });

    it('should be initialized with a registry instance', () => {
        expect(interpreter).toBeInstanceOf(Interpreter);
        // @ts-ignore
        expect(interpreter.registry).toBe(registry);
    });

    describe('render()', () => {
        it('should render a single component into the container', async () => {
            const payload: Card = {component: 'card', title: 'Hello'};
            await interpreter.render(container, payload);

            expect(container.children.length).toBe(1);
            const renderedElement = container.children[0];
            expect(renderedElement.tagName).toBe('UI-CARD');
            expect(renderedElement.setAttribute).toHaveBeenCalledWith('data', JSON.stringify(payload));
        });

        it('should render an array of components', async () => {
            const payload: Children = [{component: 'card', title: 'Card'} as Card, {component: 'text', text: 'Text'} as Text];
            await interpreter.render(container, payload);

            expect(container.children.length).toBe(2);
            expect(container.children[0].tagName).toBe('UI-CARD');
            expect(container.children[1].tagName).toBe('UI-TEXT');
        });

        it('should update an existing element when a match is found', async () => {
            const initialPayload: Text = {id: 'c1', component: 'text', text: 'Initial'};
            await interpreter.render(container, initialPayload);
            const element = container.children[0];
            const setAttributeSpy = vi.spyOn(element, 'setAttribute');

            const updatedPayload: Text = {id: 'c1', component: 'text', text: 'Updated'};
            await interpreter.render(container, updatedPayload);

            expect(container.children.length).toBe(1);
            expect(element).toBe(container.children[0]); // Ensure element is reused
            expect(setAttributeSpy).toHaveBeenCalledWith('data', JSON.stringify(updatedPayload));
        });

        it('should add new elements and remove old ones in a reconciliation pass', async () => {
            const initialPayload: Children = [
                {id: 'c1', component: 'text', text: 'Text 1'} as Text,
                {id: 'c2', component: 'card', title: 'Card 1'} as Card,
            ];
            await interpreter.render(container, initialPayload);

            const removeSpy = vi.spyOn(container.children[0], 'remove');
            const nextPayload: Children = [
                {id: 'c2', component: 'card', title: 'Card 1 updated'} as Card,
                {id: 'c3', component: 'image', src: 'img.png'} as Image,
            ];
            await interpreter.render(container, nextPayload);

            expect(container.children.length).toBe(2);
            expect(removeSpy).toHaveBeenCalled(); // Should remove old text component
            expect(container.children[0].id).toBe('c2'); // Card should be reused and moved
            expect(container.children[1].id).toBe('c3'); // New image should be added
        });

        it('should handle un-keyed components by index and type', async () => {
            const initialPayload: Children = [{component: 'text', text: 'old'} as Text, {component: 'card', title: 'old'} as Card];
            await interpreter.render(container, initialPayload);
            const oldTextEl = container.children[0];
            const oldCardEl = container.children[1];

            const updatedPayload: Children = [{component: 'text', text: 'new'} as Text, {component: 'card', title: 'new'} as Card];
            await interpreter.render(container, updatedPayload);

            expect(container.children.length).toBe(2);
            expect(container.children[0]).toBe(oldTextEl); // text element should be reused
            expect(container.children[1]).toBe(oldCardEl); // card element should be reused
        });

        it('should clear the container if the new components payload is undefined', async () => {
            const payload: Children = [{component: 'card', title: 'Card'} as Card];
            await interpreter.render(container, payload);
            expect(container.children.length).toBe(1);

            await interpreter.render(container, undefined);
            expect(container.children.length).toBe(0);
        });
    });

    describe('applyPatch()', () => {
        let findElementByIdSpy: ReturnType<typeof vi.spyOn>;
        let removeGracefullySpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            findElementByIdSpy = vi.spyOn(interpreter as any, 'findElementById');
            removeGracefullySpy = vi.spyOn(interpreter as any, 'removeElementGracefully');
        });

        it('should handle an "add" patch operation', async () => {
            const patch: Patch = {
                op: 'add',
                path: 'parent-id',
                value: {component: 'button', label: 'Click me'} as Button,
            };
            const mockParent = mockHTMLElement('div', 'parent-id');
            container.appendChild(mockParent);
            findElementByIdSpy.mockReturnValueOnce(mockParent);

            await interpreter.applyPatch(container, patch);

            expect(mockParent.children.length).toBe(1);
            const addedElement = mockParent.children[0];
            expect(addedElement.tagName).toBe('UI-BUTTON');
            expect(addedElement.setAttribute).toHaveBeenCalledWith('data', JSON.stringify(patch.value));
        });

        it('should handle an "update" patch operation', async () => {
            const existingElement = mockHTMLElement('ui-text', 'c1');
            container.appendChild(existingElement);
            findElementByIdSpy.mockReturnValueOnce(existingElement);

            const patch: Patch = {
                op: 'update',
                targetId: 'c1',
                value: {component: 'text', text: 'Updated text'} as Text,
            };
            const setAttributeSpy = vi.spyOn(existingElement, 'setAttribute');

            await interpreter.applyPatch(container, patch);

            expect(setAttributeSpy).toHaveBeenCalledWith('data', JSON.stringify(patch.value));
        });

        it('should handle a "remove" patch operation', async () => {
            const elementToRemove = mockHTMLElement('ui-card', 'c2');
            container.appendChild(elementToRemove);
            findElementByIdSpy.mockReturnValueOnce(elementToRemove);
            removeGracefullySpy.mockResolvedValue(undefined);

            const patch: Patch = {
                op: 'remove',
                targetId: 'c2',
                value: {} as Component,
            };

            await interpreter.applyPatch(container, patch);

            expect(removeGracefullySpy).toHaveBeenCalledWith(elementToRemove);
        });
    });

    describe('handleEnvelope()', () => {
        let applyPatchSpy: ReturnType<typeof vi.spyOn>;
        let renderSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            // @ts-ignore
            applyPatchSpy = vi.spyOn(interpreter, 'applyPatch').mockResolvedValue(undefined);
            // @ts-ignore
            renderSpy = vi.spyOn(interpreter, 'render').mockResolvedValue(undefined);
        });

        it('should call render() for a "message" envelope', async () => {
            const payload = [{component: 'text', text: 'Hello'} as Text];
            const envelope: Envelope = {
                type: 'message',
                convId: 'c1',
                payload,
            };
            await interpreter.handleEnvelope(container, envelope);
            expect(renderSpy).toHaveBeenCalledWith(container, envelope.payload);
        });

        it('should call applyPatch() for a "patch" envelope', async () => {
            const patch: Patch = {op: 'add', path: null, value: {component: 'card', title: 'Card'} as Card};
            const envelope: Envelope = {
                type: 'patch',
                convId: 'c1',
                payload: patch,
            };
            await interpreter.handleEnvelope(container, envelope);
            expect(applyPatchSpy).toHaveBeenCalledWith(container, patch);
        });

        it('should handle "control" envelopes with an embedded patch', async () => {
            const patch: Patch = {op: 'update', targetId: 'c1', value: {component: 'text', text: 'New text'} as Text};
            const envelope: Envelope = {
                type: 'control',
                convId: 'c1',
                payload: {patch},
            };
            await interpreter.handleEnvelope(container, envelope);
            expect(applyPatchSpy).toHaveBeenCalledWith(container, patch);
        });

        it('should log a warning for unknown envelope types', async () => {
            const envelope: Envelope = {
                type: 'unknown' as any,
                convId: 'c1',
                payload: {},
            };
            await interpreter.handleEnvelope(container, envelope);
            expect(consoleWarnSpy).toHaveBeenCalledWith('Unknown envelope type:', 'unknown');
        });
    });
});
