import type { ActionHandler } from '../types';

export const ShowDetailsHandler: ActionHandler = {
    type: 'show_details',
    handle: async ({ action, history, sendToBackend, appRoot }) => {
        const productId = action.payload?.id;
        if (!productId) {
            console.error("ShowDetails action missing product ID in payload.");
            return;
        }

        console.log(`Handling 'show_details' for product: ${productId}`);

        // Possible actions to handle:
        // 1. Send a new specific action to the backend for more details:
        //    await sendToBackend({ type: 'get_product_details', payload: { productId } }, history);
        // 2. Perform client-side navigation (if it's an SPA):
        //    window.location.hash = `/products/${productId}`;
        // 3. Render a temporary client-side modal/overlay (if appRoot is needed):
        //    appRoot.innerHTML += `<div class="modal">Loading details for ${productId}...</div>`;

        await sendToBackend({ type: 'get_product_details', payload: { productId } }, history);
    }
};
