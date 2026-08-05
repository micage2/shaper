export class AppView {
    constructor() {
        this.render();
        this.bindEvents();
    }

    render() {
        // This is already in index.html
        // But this class would handle dynamic rendering
        // if we later build the app via JS
    }

    bindEvents() {
        // View switching is handled in app.js for now
        // But could be moved here
    }
}