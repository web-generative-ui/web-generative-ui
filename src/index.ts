import {Registry} from './core/Registry';
import {Interpreter} from './core/Interpreter';
import {BaseUiComponent} from './components/BaseUiComponent';

const GenerativeUI = {
    /**
     * Creates and returns a new instance of the ComponentRegistry.
     * This is the primary interface for managing and rendering dynamic UI payloads.
     */
    create(): Registry {
        const registry = new Registry();
        const interpreter = new Interpreter(registry);

        registry.setInterpreter(interpreter);

        // Inject the singleton registry into the base component class, makes it available to all components.
        BaseUiComponent.setRegistry(registry);

        return registry;
    }
};

export default GenerativeUI;
