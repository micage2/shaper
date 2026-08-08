export class CellEditor {
    constructor(view) {
        this.view = view;
        this.model = view.model;
        this.editingCell = null;
        this.editingColumn = null;
    }

    startEditing(cell) {
        if (this.editingCell) {
            this.finishEditing(true);
        }

        const rowIdx = parseInt(cell.dataset.rowIdx, 10);
        const columnName = cell.dataset.columnName;
        const tableUuid = this.view.currentTableUuid;
        const table = this.model.getTable(tableUuid);
        if (!table) return;

        const col = table.getColumn(columnName);
        if (!col) return;

        const row = table.getRow(rowIdx);
        if (!row) return;

        const currentValue = row[columnName] !== undefined ? row[columnName] : null;
        const contentSpan = cell.querySelector('.cell-content');
        if (contentSpan) contentSpan.remove();

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
        } else if (col.type === 'array') {
            input = document.createElement('input');
            input.type = 'text';
            input.value = Array.isArray(currentValue) ? JSON.stringify(currentValue) : String(currentValue);
        } else if (col.type === 'link') {
            input = document.createElement('select');
            const targetTable = this.model.getTable(col.targetTable);
            if (targetTable) {
                for (const targetRow of targetTable.rows) {
                    const opt = document.createElement('option');
                    opt.value = targetRow._idx;
                    const displayName = this.view.getDisplayName(targetRow);
                    opt.textContent = displayName;
                    if (currentValue === targetRow._idx) {
                        opt.selected = true;
                    }
                    input.appendChild(opt);
                }
            }
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.value = currentValue !== null && currentValue !== undefined ? String(currentValue) : '';
        }

        input.className = 'cell-editor';
        input.dataset.rowIdx = rowIdx;
        input.dataset.columnName = columnName;
        cell.appendChild(input);
        input.focus();

        if (input.type !== 'select-one') {
            input.select();
        }

        this.editingCell = {
            rowIdx: rowIdx,
            columnName: columnName,
            inputElement: input,
            originalValue: currentValue,
            cellElement: cell
        };

        input.addEventListener('blur', () => this.finishEditing(false));
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
        const { rowIdx, columnName, inputElement, cellElement, originalValue } = this.editingCell;

        let newValue = originalValue;
        if (!cancel) {
            const raw = inputElement.value;
            const table = this.model.getTable(this.view.currentTableUuid);
            if (table) {
                const col = table.getColumn(columnName);
                if (col) {
                    try {
                        let coerced;
                        if (col.type === 'boolean') coerced = raw === 'true';
                        else if (col.type === 'array') {
                            try {
                                const parsed = JSON.parse(raw);
                                coerced = Array.isArray(parsed) ? parsed : [parsed];
                            } catch (_) {
                                coerced = raw.split(',').map(s => s.trim()).filter(Boolean);
                            }
                        } else if (col.type === 'number') {
                            const num = Number(raw);
                            coerced = isNaN(num) ? 0 : num;
                        } else if (col.type === 'link') {
                            coerced = raw !== '' ? Number(raw) : null;
                            if (coerced !== null && coerced !== undefined) {
                                const targetTable = this.model.getTable(col.targetTable);
                                if (targetTable) {
                                    const targetRow = targetTable.getRow(coerced);
                                    if (!targetRow) {
                                        console.warn(`[CellEditor] Invalid link: row ${coerced} not found`);
                                        coerced = null;
                                    }
                                }
                            }
                        } else {
                            coerced = String(raw);
                        }

                        const result = this.model.execute({
                            type: 'UPDATE_CELL',
                            tableUuid: this.view.currentTableUuid,
                            rowIdx: rowIdx,
                            columnName: columnName,
                            value: coerced
                        });
                        if (result.success) {
                            const updatedRow = table.getRow(rowIdx);
                            newValue = updatedRow ? updatedRow[columnName] : originalValue;
                        } else {
                            console.warn('[CellEditor] Update failed:', result.error);
                            newValue = originalValue;
                        }
                    } catch (_) {
                        newValue = originalValue;
                    }
                }
            }
        }

        inputElement.remove();
        const table = this.model.getTable(this.view.currentTableUuid);
        if (table) {
            const col = table.getColumn(columnName);
            if (col) {
                const displayValue = (cancel || newValue === undefined) ? originalValue : newValue;
                const contentSpan = document.createElement('span');
                contentSpan.className = 'cell-content';
                contentSpan.innerHTML = this.view.formatValue(displayValue, col);
                cellElement.appendChild(contentSpan);
                cellElement.dataset.rawValue = JSON.stringify(displayValue);
            }
        }
        this.editingCell = null;
    }

    startColumnRename(labelElement, col) {
        if (this.editingColumn) return;

        const currentName = col.name;
        const content = labelElement.closest('.col-header-content');
        if (!content) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'column-name-editor';
        input.value = currentName;
        input.dataset.columnName = col.name;

        labelElement.style.display = 'none';
        content.insertBefore(input, labelElement);

        input.focus();
        input.select();

        this.editingColumn = {
            labelElement: labelElement,
            inputElement: input,
            col: col,
            originalValue: currentName,
            isFinished: false
        };

        input.addEventListener('blur', () => this.finishColumnRename(false));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.finishColumnRename(false);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.finishColumnRename(true);
            }
        });
    }

    finishColumnRename(cancel = false) {
        if (!this.editingColumn) return;
        if (this.editingColumn.isFinished) return;
        this.editingColumn.isFinished = true;

        const { labelElement, inputElement, col, originalValue } = this.editingColumn;

        if (!cancel) {
            const newName = inputElement.value.trim();
            if (newName && newName !== originalValue) {
                const result = this.model.execute({
                    type: 'RENAME_COLUMN',
                    tableUuid: this.view.currentTableUuid,
                    oldName: originalValue,
                    newName: newName
                });
                if (result.success) {
                    labelElement.textContent = newName;
                    labelElement.dataset.columnName = newName;
                    col.name = newName;
                } else {
                    console.error('[CellEditor] Failed to rename column:', result.error);
                }
            }
        }

        inputElement.remove();
        labelElement.style.display = '';
        this.editingColumn = null;
    }
}
