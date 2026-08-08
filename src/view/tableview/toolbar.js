// src/tableview/Toolbar.js

import { createElement } from '../dom-utils.js';
import { ToolbarLeft } from './toolbar-left.js';
import { ToolbarMiddle } from './toolbar-middle.js';
import { ToolbarRight } from './toolbar-right.js';

export class Toolbar {
    constructor(view) {
        this.view = view;
        this.model = view.model;
        this.container = null;
        this.left = new ToolbarLeft(view);
        this.middle = new ToolbarMiddle(view);
        this.right = new ToolbarRight(view);
    }

    render() {
        this.container = createElement('div', { className: 'toolbar toolbar-table' });
        
        const leftEl = this.left.render();
        const middleEl = this.middle.render();
        const rightEl = this.right.render();
        
        this.container.appendChild(leftEl);
        this.container.appendChild(middleEl);
        this.container.appendChild(rightEl);
        
        return this.container;
    }

    // Refresh the toolbar (rebuild idle state)
    refresh() {
        this.left.buildIdle();
        this.middle.buildIdle();
        this.right.buildIdle();
    }
}
