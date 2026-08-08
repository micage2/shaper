import { createElement, createButton } from '../dom-utils.js';
import { createDeleteConfirmUI } from './confirm-modes.js';

export class ToolbarMiddle {
    constructor(view) {
        this.view = view;
        this.model = view.model;
        this.container = null;
        this.mode = 'idle'; // 'idle' | 'deleting-table'
    }

    render() {
        this.container = createElement('div', { className: 'toolbar-middle' });
        this.buildIdle();
        return this.container;
    }

    buildIdle() {
        // Clear and rebuild idle state
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        this.mode = 'idle';

        // + Table
        const addTableBtn = createButton('+ Table', 'btn btn-success btn-sm', () => {
            this.view.handleAddTable();
        });
        this.container.appendChild(addTableBtn);

        // ✏️ Rename Table
        const renameTableBtn = createButton('✏️', 'btn btn-rename btn-sm', () => {
            this.view.handleRenameTable();
        });
        renameTableBtn.title = 'Rename table';
        this.container.appendChild(renameTableBtn);

        // 🗑 Delete Table
        const deleteTableBtn = createButton('🗑', 'btn btn-danger btn-sm', () => {
            this.enterDeleteMode();
        });
        deleteTableBtn.title = 'Delete table';
        this.container.appendChild(deleteTableBtn);

        return this.container;
    }

    enterDeleteMode() {
        const table = this.model.getTable(this.view.currentTableUuid);
        if (!table) return;
        
        if (Object.keys(this.model.tables).length === 1) {
            console.warn('[ToolbarMiddle] Cannot delete the last table');
            return;
        }

        this.mode = 'deleting-table';
        
        // Clear container
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }

        // Build delete confirmation UI
        const { container, cleanup } = createDeleteConfirmUI({
            itemName: table.name,
            confirmText: '✓ Confirm',
            onConfirm: () => {
                cleanup();
                this.view.handleDeleteTable();
                this.buildIdle();
            },
            onCancel: () => {
                cleanup();
                this.buildIdle();
            }
        });

        this.container.appendChild(container);
    }
}
