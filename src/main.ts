import "./transition.css"
import GenerativeUI from './index';
import type { Patch } from "./schema.ts";

async function main() {
    const registry = GenerativeUI.create();
    const appRoot = document.getElementById('app'); // or replace it with the container you want to render into aside from your main UI

    if (!appRoot) {
        console.error("Element with ID 'app' not found.");
        return;
    }

    appRoot.innerHTML = '';

    const eventSource = new EventSource('http://localhost:3000/api/llm-stream');

    eventSource.onmessage = async (event) => {
        try {
            const patch: Patch = JSON.parse(event.data);
            console.log("Received patch:", patch);

            await registry.getInterpreter().applyPatch(appRoot, patch);

        } catch (error) {
            console.error("Failed to parse or apply patch:", error, "Data:", event.data);
        }
    };

    eventSource.onerror = (_) => {
        console.log("Stream connection closed by server");
        eventSource.close();
    };

    eventSource.addEventListener('close', () => {
        console.log("Received close signal from server.");
        eventSource.close();
    });
}

main();
