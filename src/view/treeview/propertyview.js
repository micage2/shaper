export class PropertyView {
    constructor(container, model) {
        this.container = container;
        this.model = model;
        this.selectedRowIdx = null;
        this.selectedTableUuid = null;
        this.onNavigate = null;
        this.editingCell = null;

        this.unsubscribe = model.subscribe(() => {
            if (this.selectedRowIdx !== null && this.selectedTableUuid !== null) {
                this.render();
            }
        });

        this.render();
    }

    selectInstance(rowIdx, tableUuid) {
        this.selectedRowIdx = rowIdx;
        this.selectedTableUuid = tableUuid;
        this.render();
    }

    render() {
        this.container.innerHTML = '';

        if (this.selectedRowIdx === null || this.selectedTableUuid === null) {
            this.container.innerHTML = '<div class="property-empty">Select an instance to view properties</div>';
            return;
        }

        const table = this.model.getTable(this.selectedTableUuid);
        if (!table) {
            this.container.innerHTML = '<div class="property-empty">Table not found</div>';
            return;
        }

        const row = table.getRow(this.selectedRowIdx);
        if (!row) {
            this.container.innerHTML = '<div class="property-empty">Row not found</div>';
            return;
        }

        const container = document.createElement('div');
        container.className = 'property-container';

        // Header
        const header = document.createElement('div');
        header.className = 'property-header';
        const displayName = this.getDisplayName(row);
        header.innerHTML = `
            <span class="property-title">${displayName}</span>
            <span class="property-type">[${table.name}]</span>
            <span class="property-idx">#${row._idx}</span>
        `;
        container.appendChild(header);

        // Property list
        const list = document.createElement('div');
        list.className = 'property-list';

        for (const col of table.columns) {
            const value = row[col.name];
            const item = document.createElement('div');
            item.className = 'property-item';
            item.dataset.columnName = col.name;

            const label = document.createElement('span');
            label.className = 'property-label';
            label.textContent = col.name;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'property-value';
            valueSpan.dataset.columnName = col.name;
            valueSpan.dataset.rowIdx = this.selectedRowIdx;

            // Render value
            this.renderValue(valueSpan, value, col, row);

            // Double-click to edit
            valueSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startEditing(valueSpan, col, row);
            });

            item.appendChild(label);
            item.appendChild(valueSpan);
            list.appendChild(item);
        }

        container.appendChild(list);
        this.container.appendChild(container);
    }

    renderValue(container, value, col, row) {
        container.innerHTML = '';

        if (col.type === 'link' && value !== null && value !== undefined) {
            const targetTable = this.model.getTable(col.targetTable);
            if (targetTable) {
                const targetRow = targetTable.getRow(value);
                if (targetRow) {
                    const displayName = this.getDisplayName(targetRow);

                    // Link text (clickable for navigation)
                    const link = document.createElement('a');
                    link.className = 'property-link';
                    link.textContent = displayName;
                    link.href = '#';
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (this.editingCell) return;
                        if (this.onNavigate) {
                            this.onNavigate(value, col.targetTable);
                        }
                        this.selectInstance(value, col.targetTable);
                    });
                    container.appendChild(link);

                    // Edit icon
                    const editIcon = document.createElement('span');
                    editIcon.className = 'property-edit-icon';
                    editIcon.textContent = ' ✏️';
                    editIcon.style.cursor = 'pointer';
                    editIcon.style.fontSize = '11px';
                    editIcon.style.opacity = '0.4';
                    editIcon.style.marginLeft = '4px';
                    editIcon.title = 'Edit link';
                    editIcon.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (this.editingCell) return;
                        this.startEditing(container, col, row);
                    });
                    // Show on hover
                    const wrapper = container;
                    wrapper.style.display = 'inline-flex';
                    wrapper.style.alignItems = 'center';
                    wrapper.addEventListener('mouseenter', () => {
                        editIcon.style.opacity = '0.8';
                    });
                    wrapper.addEventListener('mouseleave', () => {
                        editIcon.style.opacity = '0.4';
                    });

                    container.appendChild(editIcon);
                    return;
                }
            }
            container.textContent = `❌ Invalid link (row ${value})`;
            return;
        }

        if (col.type === 'boolean') {
            container.textContent = value ? '✓ true' : '✗ false';
            return;
        }

        if (col.type === 'array') {
            container.textContent = Array.isArray(value) ? JSON.stringify(value) : String(value);
            return;
        }

        container.textContent = value !== undefined && value !== null ? String(value) : '—';
    }

    startEditing(container, col, row) {
        if (this.editingCell) {
            this.finishEditing(true);
        }

        const currentValue = row[col.name];
        const displayValue = currentValue !== undefined && currentValue !== null ? String(currentValue) : '';

        let input;
        if (col.type === 'boolean') {
            input = document.createElement('select');
            const optTrue = document.createElement('option');
            optTrue.value = 'true';
            optTrue.textContent = 'true';
            const optFalse = document.createElement('option');
            optFalse.value = 'false';
            optFalse.textContent = 'false';
            input.appendChild(optTrue);
            input.appendChild(optFalse);
            input.value = currentValue ? 'true' : 'false';
        }
        else if (col.type === 'link') {
            input = document.createElement('select');
            input.style.width = 'auto';
            input.style.minWidth = '150px';

            // NO "-- Select --" option

            const targetTable = this.model.getTable(col.targetTable);
            if (targetTable) {
                // Add a "Clear" option as first item
                const clearOpt = document.createElement('option');
                clearOpt.value = '';
                clearOpt.textContent = '— Clear —';
                if (currentValue === null || currentValue === undefined) {
                    clearOpt.selected = true;
                }
                input.appendChild(clearOpt);

                for (const targetRow of targetTable.rows) {
                    const opt = document.createElement('option');
                    opt.value = targetRow._idx;
                    opt.textContent = this.getDisplayName(targetRow);
                    if (currentValue === targetRow._idx) {
                        opt.selected = true;
                    }
                    input.appendChild(opt);
                }
            }
        }
        else {
            input = document.createElement('input');
            input.type = 'text';
            input.value = displayValue;
        }

        input.className = 'property-editor';
        container.innerHTML = '';
        container.appendChild(input);

        input.focus();
        if (input.select) input.select();

        this.editingCell = {
            container: container,
            input: input,
            col: col,
            row: row,
            originalValue: currentValue
        };

        input.addEventListener('blur', () => {
            this.finishEditing(false);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.finishEditing(false);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.finishEditing(true);
            }
        });
    }

    finishEditing(cancel = false) {
        if (!this.editingCell) return;

        const { container, input, col, row, originalValue } = this.editingCell;

        let newValue = originalValue;
        if (!cancel) {
            let raw = input.value;
            let coerced;

            if (col.type === 'boolean') {
                coerced = raw === 'true';
            }
            else if (col.type === 'number') {
                const num = Number(raw);
                coerced = isNaN(num) ? 0 : num;
            }
            else if (col.type === 'link') {
                coerced = raw !== '' ? Number(raw) : null;
                // Validate link
                if (coerced !== null && coerced !== undefined && coerced !== '') {
                    const targetTable = this.model.getTable(col.targetTable);
                    if (targetTable) {
                        const targetRow = targetTable.getRow(coerced);
                        if (!targetRow) {
                            console.warn(`Invalid link: row ${coerced} not found in ${targetTable.name}`);
                            coerced = null;
                        }
                    }
                }                
            }
            else if (col.type === 'array') {
                try {
                    coerced = JSON.parse(raw);
                    if (!Array.isArray(coerced)) coerced = [coerced];
                } catch (_) {
                    coerced = raw.split(',').map(s => s.trim()).filter(Boolean);
                }
            } else {
                coerced = String(raw);
            }

            // Update via command
            const table = this.model.getTable(this.selectedTableUuid);
            if (table) {
                const result = this.model.execute({
                    type: 'UPDATE_CELL',
                    tableUuid: this.selectedTableUuid,
                    rowIdx: this.selectedRowIdx,
                    columnName: col.name,
                    value: coerced
                });
                if (result.success) {
                    newValue = table.getRow(this.selectedRowIdx)[col.name];
                } else {
                    console.warn('Update failed:', result.error);
                }
            }
        }

        // Restore display
        this.renderValue(container, newValue, col, row);
        this.editingCell = null;
    }

    getDisplayName(row) {
        if (row.name && typeof row.name === 'string') {
            return row.name;
        }
        return `#${row._idx}`;
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.editingCell) {
            this.finishEditing(true);
        }
    }
}