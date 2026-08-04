export function generateUUID() {
    return Math.random().toString(36).slice(2, 11) +
        Math.random().toString(36).slice(2, 11);
}

