// ============================================
// CELL EDITOR - Handles cell editing
// ============================================
class CellEditor {
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

            // No " — Select — " option — must have a value
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
                            // Validate link
                            if (coerced !== null && coerced !== undefined) {
                                const targetTable = this.model.getTable(col.targetTable);
                                if (targetTable) {
                                    const targetRow = targetTable.getRow(coerced);
                                    if (!targetRow) {
                                        console.warn(`[CellEditor] Invalid link: row ${coerced} not found in ${targetTable.name}`);
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
}

// ============================================
// TABLE VIEW - Main Component
// ============================================
export class TableView {
    constructor(container, model) {
        this.container = container;
        this.model = model;
        this.currentTableUuid = null;
        this.columnWidths = {};
        this.isRenamingTable = false;
        this.tableRenameInput = null;

        this.cellEditor = new CellEditor(this);
        this.table = null;
        this.colGroup = null;
        this.scrollWrapper = null;
        this.headerContainer = null;

        // Subscribe to model changes
        this.unsubscribe = model.subscribe(() => {
            // If we have a current table, re-render
            if (this.currentTableUuid && this.model.getTable(this.currentTableUuid)) {
                this.render();
            }
        });

        // Set first table as current
        const tableNames = this.model.getTableNames();
        if (tableNames.length > 0) {
            const firstTable = this.model.getTableByName(tableNames[0]);
            if (firstTable) {
                this.currentTableUuid = firstTable.uuid;
            }
        }

        this.render();
    }

    render() {
        console.log('[TableView] render() called');
        
        // Clear everything in one go
        this.container.replaceChildren();
        
        // Reset DOM references
        this.table = null;
        this.colGroup = null;
        this.scrollWrapper = null;
        this.headerContainer = null;
        
        this.renderHeader();
        this.renderTable();
    }

    renderHeader() {
        const currentTable = this.model.getTable(this.currentTableUuid);
        const header = document.createElement('div');
        header.className = 'toolbar toolbar-table';
        this.headerContainer = header;

        // ----- LEFT GROUP -----
        const leftDiv = document.createElement('div');
        leftDiv.className = 'toolbar-left';

        // Table selector
        const select = document.createElement('select');
        select.className = 'table-selector';
        const tableNames = this.model.getTableNames();
        for (const name of tableNames) {
            const table = this.model.getTableByName(name);
            if (!table) continue;
            const opt = document.createElement('option');
            opt.value = table.uuid;
            opt.textContent = name;
            if (table.uuid === this.currentTableUuid) {
                opt.selected = true;
            }
            select.appendChild(opt);
        }
        select.addEventListener('change', (e) => {
            this.currentTableUuid = e.target.value;
            this.columnWidths = {};
            this.render();
        });
        leftDiv.appendChild(select);

        // Row count badge
        if (currentTable) {
            const badge = document.createElement('span');
            badge.className = 'badge-count';
            badge.textContent = `${currentTable.rowCount()} rows · ${currentTable.columns.length} cols`;
            leftDiv.appendChild(badge);
        }

        // Add row button
        const addRowBtn = document.createElement('button');
        addRowBtn.className = 'btn btn-success btn-sm';
        addRowBtn.textContent = '+ Row';
        addRowBtn.addEventListener('click', () => this.handleAddRow());
        leftDiv.appendChild(addRowBtn);

        // Delete row button
        const delRowBtn = document.createElement('button');
        delRowBtn.className = 'btn btn-danger btn-sm';
        delRowBtn.textContent = '🗑 Row';
        delRowBtn.addEventListener('click', () => this.handleDeleteRow());
        leftDiv.appendChild(delRowBtn);

        header.appendChild(leftDiv);

        // ----- MIDDLE GROUP -----
        const middleDiv = document.createElement('div');
        middleDiv.className = 'toolbar-middle';

        // Add column
        const colNameInput = document.createElement('input');
        colNameInput.type = 'text';
        colNameInput.className = 'col-name-input';
        colNameInput.placeholder = 'Name';
        colNameInput.id = 'newColName';

        const colTypeSelect = document.createElement('select');
        colTypeSelect.className = 'col-type-select';
        ['string', 'number', 'boolean', 'array', 'link'].forEach(type => {
            const opt = document.createElement('option');
            opt.value = type;
            opt.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            colTypeSelect.appendChild(opt);
        });

        const colTargetSelect = document.createElement('select');
        colTargetSelect.className = 'col-target-select';
        colTargetSelect.style.display = 'none';
        for (const [uuid, table] of Object.entries(this.model.tables)) {
            if (uuid === this.currentTableUuid) continue;
            const opt = document.createElement('option');
            opt.value = uuid;
            opt.textContent = table.name;
            colTargetSelect.appendChild(opt);
        }

        colTypeSelect.addEventListener('change', () => {
            colTargetSelect.style.display = colTypeSelect.value === 'link' ? 'inline-block' : 'none';
        });

        const addColBtn = document.createElement('button');
        addColBtn.className = 'btn btn-primary btn-sm';
        addColBtn.textContent = '+ Column';
        addColBtn.addEventListener('click', () => {
            this.handleAddColumn(colNameInput, colTypeSelect, colTargetSelect);
        });

        // Rename column button
        const renameColBtn = document.createElement('button');
        renameColBtn.className = 'btn btn-primary btn-sm';
        renameColBtn.textContent = '✏️ Col';
        renameColBtn.title = 'Rename selected column';
        renameColBtn.addEventListener('click', () => {
            // Prompt for column name to rename
            const oldName = prompt('Enter the current column name:');
            if (!oldName) return;
            const newName = prompt('Enter the new column name:');
            if (!newName) return;
            this.handleRenameColumn(oldName, newName);
        });
        middleDiv.appendChild(renameColBtn);

        // Delete column button
        const delColBtn = document.createElement('button');
        delColBtn.className = 'btn btn-danger btn-sm';
        delColBtn.textContent = '🗑 Col';
        delColBtn.title = 'Delete selected column';
        delColBtn.addEventListener('click', () => {
            const colName = prompt('Enter the column name to delete:');
            if (!colName) return;
            this.handleDeleteColumn(colName);
        });
        middleDiv.appendChild(delColBtn);

        middleDiv.appendChild(colNameInput);
        middleDiv.appendChild(colTypeSelect);
        middleDiv.appendChild(colTargetSelect);
        middleDiv.appendChild(addColBtn);

        header.appendChild(middleDiv);

        // ----- RIGHT GROUP -----
        const rightDiv = document.createElement('div');
        rightDiv.className = 'toolbar-right';
        // Add any right-side controls if needed
        header.appendChild(rightDiv);

        this.container.appendChild(header);
    }

    renderTable() {
        const currentTable = this.model.getTable(this.currentTableUuid);
        if (!currentTable) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No table selected or table not found.';
            this.container.appendChild(empty);
            return;
        }

        const columns = currentTable.columns;
        const rows = currentTable.rows;

        // Create scroll wrapper
        this.scrollWrapper = document.createElement('div');
        this.scrollWrapper.className = 'table-scroll-wrapper';
        this.scrollWrapper.style.flex = '1 1 auto';
        this.scrollWrapper.style.minHeight = '0';
        this.scrollWrapper.style.overflow = 'auto';
        this.scrollWrapper.style.position = 'relative';
        this.container.appendChild(this.scrollWrapper);

        const table = document.createElement('table');
        table.className = 'data-table';
        this.table = table;

        // Colgroup
        this.colGroup = document.createElement('colgroup');
        // Row index column
        const idxCol = document.createElement('col');
        idxCol.style.width = '50px';
        idxCol.style.minWidth = '50px';
        idxCol.style.maxWidth = '50px';
        this.colGroup.appendChild(idxCol);

        // Data columns
        for (const col of columns) {
            const c = document.createElement('col');
            const width = this.columnWidths[col.name] || 120;
            c.style.width = width + 'px';
            c.style.minWidth = width + 'px';
            c.style.maxWidth = width + 'px';
            this.colGroup.appendChild(c);
        }
        table.appendChild(this.colGroup);

        // Thead
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // Row index header
        const thIdx = document.createElement('th');
        thIdx.textContent = '#';
        thIdx.style.width = '50px';
        thIdx.style.minWidth = '50px';
        thIdx.style.maxWidth = '50px';
        thIdx.style.textAlign = 'center';
        thIdx.style.fontWeight = 'bold';
        headerRow.appendChild(thIdx);

        // Column headers
        for (const col of columns) {
            const th = document.createElement('th');
            const contentDiv = document.createElement('div');
            contentDiv.className = 'col-header-content';

            // Type badge
            const typeSpan = document.createElement('span');
            typeSpan.className = 'col-type';
            let typeLabel = col.type;
            if (col.type === 'link' && col.targetTable) {
                const targetName = this.model.getTableNameByUuid(col.targetTable) || 'unknown';
                typeLabel = `link → ${targetName}`;
            }
            typeSpan.textContent = typeLabel;
            contentDiv.appendChild(typeSpan);

            // Column name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'col-name';
            nameSpan.textContent = col.name;
            nameSpan.dataset.columnName = col.name;
            contentDiv.appendChild(nameSpan);

            // Delete column button (hover)
            const delBtn = document.createElement('button');
            delBtn.className = 'col-delete-btn';
            delBtn.textContent = '✕';
            delBtn.title = `Delete column "${col.name}"`;
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete column "${col.name}"?`)) {
                    this.handleDeleteColumn(col.name);
                }
            });
            const wrapper = document.createElement('div');
            wrapper.className = 'col-delete-wrapper';
            wrapper.appendChild(delBtn);
            contentDiv.appendChild(wrapper);

            th.appendChild(contentDiv);
            headerRow.appendChild(th);

            // Resizer (for all columns except last)
            // Will implement later
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Tbody
        const tbody = document.createElement('tbody');
        if (rows.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.setAttribute('colspan', columns.length + 1);
            emptyCell.className = 'empty-state';
            emptyCell.textContent = '✨ No rows yet. Click "+ Row" to add one.';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        } else {
            for (const row of rows) {
                const tr = document.createElement('tr');
                tr.dataset.rowIdx = row._idx;

                // Row index cell
                const tdIdx = document.createElement('td');
                tdIdx.textContent = row._idx;
                tdIdx.style.textAlign = 'center';
                tdIdx.style.fontWeight = 'bold';
                tdIdx.style.color = '#94a3b8';
                tdIdx.style.fontSize = '12px';
                tr.appendChild(tdIdx);

                // Data cells
                for (const col of columns) {
                    const td = document.createElement('td');
                    td.className = 'editable-cell';
                    td.dataset.rowIdx = row._idx;
                    td.dataset.columnName = col.name;

                    const value = row[col.name] !== undefined ? row[col.name] : null;
                    const contentSpan = document.createElement('span');
                    contentSpan.className = 'cell-content';
                    contentSpan.innerHTML = this.formatValue(value, col);
                    td.appendChild(contentSpan);
                    td.dataset.rawValue = JSON.stringify(value);

                    td.addEventListener('dblclick', () => {
                        if (!this.cellEditor.editingCell) {
                            this.cellEditor.startEditing(td);
                        }
                    });

                    tr.appendChild(td);
                }

                tbody.appendChild(tr);
            }
        }

        table.appendChild(tbody);
        this.scrollWrapper.appendChild(table);

        // Ensure container has proper flex
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.overflow = 'hidden';
    }

    formatValue(value, col) {
        if (value === null || value === undefined || value === '') {
            return '<span class="empty-value">—</span>';
        }
        switch (col.type) {
            case 'array':
                if (!Array.isArray(value)) return String(value);
                if (value.length === 0) return '<span class="empty-value">[]</span>';
                return value.map(item =>
                    `<span class="array-badge">${String(item)}</span>`
                ).join(' ');
            case 'boolean':
                return value ? '✔ true' : '✘ false';
            case 'link':
                if (col.targetTable && value !== null) {
                    const targetTable = this.model.getTable(col.targetTable);
                    if (targetTable) {
                        const targetRow = targetTable.getRow(value);
                        if (targetRow) {
                            const displayName = this.getDisplayName(targetRow);
                            return `<span class="link-badge">🔗 ${displayName}</span>`;
                        }
                    }
                }
                return `<span class="link-badge">🔗 ${String(value)}</span>`;
            default:
                return String(value);
        }
    }

    getDisplayName(row) {
        if (row.name && typeof row.name === 'string') {
            return row.name;
        }
        return `#${row._idx}`;
    }

    // ----- Table Operations -----
    handleAddRow() {
        const table = this.model.getTable(this.currentTableUuid);
        if (!table) return;
    
        // Check if all link columns have valid targets
        for (const col of table.columns) {
            if (col.type === 'link') {
                const targetTable = this.model.getTable(col.targetTable);
                if (!targetTable || targetTable.rows.length === 0) {
                    console.error(`[TableView] Cannot add row: target table "${col.targetTable}" has no rows`);
                    alert(`Cannot add row: "${col.name}" has no valid target. Add a row to the target table first.`);
                    return;
                }
            }
        }
    
        // Build row data with defaults
        const rowData = {};
        const nextIdx = table._nextIdx;
        
        for (const col of table.columns) {
            if (col.type === 'link') {
                const targetTable = this.model.getTable(col.targetTable);
                rowData[col.name] = targetTable.rows[0]._idx;
            } else if (col.type === 'string') {
                rowData[col.name] = `no_${col.name}_${nextIdx}`;
            } else if (col.type === 'number') {
                rowData[col.name] = 0;
            } else if (col.type === 'boolean') {
                rowData[col.name] = true;
            } else if (col.type === 'array') {
                rowData[col.name] = [];
            }
        }
    
        // Ensure name exists
        if (!rowData.name) {
            rowData.name = `no_name_${nextIdx}`;
        }
    
        const result = this.model.execute({
            type: 'ADD_ROW',
            tableUuid: this.currentTableUuid,
            data: rowData
        });
    
        if (!result.success) {
            console.error('[TableView] Failed to insert row:', result.error);
            alert(result.error);
        }
    }

    handleDeleteRow() {
        const table = this.model.getTable(this.currentTableUuid);
        if (!table || table.rows.length === 0) return;
    
        const rowIdx = prompt(`Enter row index to delete (0 to ${table.rows.length - 1}):`);
        if (rowIdx === null) return;
        const idx = parseInt(rowIdx, 10);
        if (isNaN(idx)) {
            alert('Invalid row index.');
            return;
        }
    
        const row = table.getRow(idx);
        if (!row) {
            alert(`Row ${idx} not found.`);
            return;
        }
    
        if (confirm(`Delete row #${idx} "${row.name || 'Unnamed'}"?`)) {
            // ✅ Use model.execute()
            const result = this.model.execute({
                type: 'DELETE_ROW',
                tableUuid: this.currentTableUuid,
                rowIdx: idx
            });
            if (!result.success) {
                console.error('[TableView] Failed to delete row:', result.error);
                alert(result.error);
            }
        }
    }
    
    handleAddColumn(colNameInput, colTypeSelect, colTargetSelect) {
        const name = colNameInput.value.trim();
        const type = colTypeSelect.value;
        if (!name) {
            alert('Please enter a column name.');
            return;
        }
    
        const table = this.model.getTable(this.currentTableUuid);
        if (!table) return;
    
        const column = { name, type };
        if (type === 'link') {
            const targetTable = colTargetSelect.value;
            if (!targetTable) {
                alert('Please select a target table for the link column.');
                return;
            }
            column.targetTable = targetTable;
        }
    
        // ✅ Use model.execute()
        const result = this.model.execute({
            type: 'ADD_COLUMN',
            tableUuid: this.currentTableUuid,
            column: column
        });
    
        if (result.success) {
            colNameInput.value = '';
            colTypeSelect.value = 'string';
            colTargetSelect.style.display = 'none';
        } else {
            console.error('[TableView] Failed to add column:', result.error);
            alert(result.error);
        }
    }
    
    handleDeleteColumn(columnName) {
        const table = this.model.getTable(this.currentTableUuid);
        if (!table) return;
    
        const col = table.getColumn(columnName);
        if (!col) {
            alert(`Column "${columnName}" not found.`);
            return;
        }
    
        if (confirm(`Delete column "${columnName}"? This will remove all data in this column.`)) {
            // ✅ Use model.execute()
            const result = this.model.execute({
                type: 'DELETE_COLUMN',
                tableUuid: this.currentTableUuid,
                columnName: columnName
            });
            if (!result.success) {
                console.error('[TableView] Failed to delete column:', result.error);
                alert(result.error);
            }
        }
    }
    
    handleRenameColumn(oldName, newName) {
        const table = this.model.getTable(this.currentTableUuid);
        if (!table) return;
    
        const col = table.getColumn(oldName);
        if (!col) {
            alert(`Column "${oldName}" not found.`);
            return;
        }
    
        // ✅ Use model.execute()
        const result = this.model.execute({
            type: 'RENAME_COLUMN',
            tableUuid: this.currentTableUuid,
            oldName: oldName,
            newName: newName
        });
    
        if (!result.success) {
            console.error('[TableView] Failed to rename column:', result.error);
            alert(result.error);
        }
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}