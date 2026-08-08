import { createElement, createInput, createSelect, createButton } from '../dom-utils.js';
import { createEditConfirmUI, createDeleteConfirmUI } from './confirm-modes.js';

export class ToolbarRight {
    constructor(view) {
        this.view = view;
        this.model = view.model;
        this.container = null;
        this.mode = 'idle'; // 'idle' | 'adding-column' | 'deleting-column'
        this.currentType = 'string';
        this.currentTarget = null;
    }

    render() {
        this.container = createElement('div', { className: 'toolbar-right' });
        this.buildIdle();
        return this.container;
    }

    buildIdle() {
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        this.mode = 'idle';

        const table = this.model.getTable(this.view.currentTableUuid);
        const hasLinkColumn = table ? table.columns.some(col => col.type === 'link') : false;

        // Name input
        const nameInput = createInput('text', '', 'Name', 'col-name-input');
        this.container.appendChild(nameInput);

        // Type select
        const typeOptions = ['string', 'number', 'boolean', 'array', 'link'].map(type => ({
            value: type,
            label: type.charAt(0).toUpperCase() + type.slice(1)
        }));
        
        const typeSelect = createSelect(
            typeOptions,
            'string',
            'col-type-select',
            (e) => {
                this.currentType = e.target.value;
                // Show/hide target select
                const targetSelect = this.container.querySelector('.col-target-select');
                if (targetSelect) {
                    targetSelect.style.display = this.currentType === 'link' ? 'inline-block' : 'none';
                }
            }
        );
        
        // Disable 'link' option if table already has a link column
        if (hasLinkColumn) {
            typeSelect.querySelector('option[value="link"]').disabled = true;
        }
        
        this.container.appendChild(typeSelect);

        // Target table select (for link type)
        const targetOptions = [];
        for (const [uuid, t] of Object.entries(this.model.tables)) {
            if (uuid === this.view.currentTableUuid) continue;
            targetOptions.push({ value: uuid, label: t.name });
        }
        
        const targetSelect = createSelect(
            targetOptions,
            null,
            'col-target-select',
            (e) => {
                this.currentTarget = e.target.value;
            }
        );
        targetSelect.style.display = 'none';
        this.container.appendChild(targetSelect);

        // + Column button
        const addColBtn = createButton('+ Column', 'btn btn-success btn-sm', () => {
            this.enterAddMode();
        });
        this.container.appendChild(addColBtn);

        // 🗑 Col button
        const deleteColBtn = createButton('🗑 Col', 'btn btn-danger btn-sm', () => {
            this.enterDeleteMode();
        });
        deleteColBtn.title = 'Delete column';
        this.container.appendChild(deleteColBtn);

        return this.container;
    }

    enterAddMode() {
        const table = this.model.getTable(this.view.currentTableUuid);
        if (!table) return;

        this.mode = 'adding-column';
        
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }

        // Get current type and target for the new column
        const type = this.currentType || 'string';
        const target = this.currentTarget || null;

        const { container, input, cleanup } = createEditConfirmUI({
            value: '',
            placeholder: 'Column name',
            okText: '✓ OK',
            onConfirm: (value) => {
                cleanup();
                const name = value.trim();
                if (!name) {
                    console.warn('[ToolbarRight] Column name required');
                    this.buildIdle();
                    return;
                }

                const column = { name, type };
                if (type === 'link' && target) {
                    column.targetTable = target;
                }

                const result = this.model.execute({
                    type: 'ADD_COLUMN',
                    tableUuid: this.view.currentTableUuid,
                    column: column
                });

                if (result.success) {
                    this.view.columnWidths = {};
                } else {
                    console.error('[ToolbarRight] Failed to add column:', result.error);
                }
                this.buildIdle();
            },
            onCancel: () => {
                cleanup();
                this.buildIdle();
            }
        });

        this.container.appendChild(container);
    }

    enterDeleteMode() {
        const table = this.model.getTable(this.view.currentTableUuid);
        if (!table || table.columns.length === 0) return;

        this.mode = 'deleting-column';
        
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }

        // Create dropdown for column selection
        const colSelect = document.createElement('select');
        colSelect.className = 'col-delete-select';
        colSelect.style.padding = '3px 8px';
        colSelect.style.border = '1px solid #dce5ef';
        colSelect.style.borderRadius = '4px';
        colSelect.style.fontSize = '12px';
        colSelect.style.outline = 'none';
        colSelect.style.minWidth = '100px';

        for (const col of table.columns) {
            const opt = document.createElement('option');
            opt.value = col.name;
            opt.textContent = col.name;
            colSelect.appendChild(opt);
        }

        // Use confirm UI with the select
        const { container, cleanup } = createDeleteConfirmUI({
            itemName: colSelect,
            confirmText: '✓ Confirm',
            onConfirm: () => {
                cleanup();
                const columnName = colSelect.value;
                if (!columnName) {
                    this.buildIdle();
                    return;
                }

                const result = this.model.execute({
                    type: 'DELETE_COLUMN',
                    tableUuid: this.view.currentTableUuid,
                    columnName: columnName
                });

                if (result.success) {
                    this.view.columnWidths = {};
                } else {
                    console.error('[ToolbarRight] Failed to delete column:', result.error);
                }
                this.buildIdle();
            },
            onCancel: () => {
                cleanup();
                this.buildIdle();
            }
        });

        // Replace the prompt with the select
        // The confirm UI creates a container with prompt + buttons
        // We need to replace the prompt with our select
        const promptEl = container.querySelector('.confirm-prompt');
        if (promptEl) {
            promptEl.replaceWith(colSelect);
        }

        this.container.appendChild(container);
    }
}
