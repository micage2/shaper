export class TableView {
    constructor(container, model) {
        this.container = container;
        this.model = model;
        this.editingCell = null;
        this.resizeData = null;
        this.columnWidths = [];
        this.tableWidth = 0;
        this.table = null;
        this.colGroup = null;

        // Subscribe to model changes
        this.unsubscribe = model.subscribe(() => {
            this.render();
        });

        // Bind event handlers
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleResizeStart = this.handleResizeStart.bind(this);
        this.handleResizeMove = this.handleResizeMove.bind(this);
        this.handleResizeEnd = this.handleResizeEnd.bind(this);
        this.handleTableSelectorChange = this.handleTableSelectorChange.bind(this);
        this.handleAddColumn = this.handleAddColumn.bind(this);
        this.handleAddInstance = this.handleAddInstance.bind(this);

        // Initial render
        this.render();

        // Global event listeners for resizing
        document.addEventListener('mousemove', this.handleResizeMove);
        document.addEventListener('mouseup', this.handleResizeEnd);
    }

    render() {
        this.container.innerHTML = '';
        this.renderHeader();
        this.renderTable();
    }

    renderHeader() {
        const currentTable = this.model.getCurrentTable();
        const tableNames = this.model.getTableNames();

        const header = document.createElement('div');
        header.className = 'tableview-header';

        const leftDiv = document.createElement('div');
        leftDiv.className = 'tableview-header-left';

        const select = document.createElement('select');
        select.className = 'table-selector';
        tableNames.forEach(name => {
            const option = document.createElement('option');
            const tableId = this.model.getTableIdByName(name);
            option.value = tableId;
            option.textContent = name;
            const table = this.model.getTableByName(name);
            if (table && table.id === this.model.currentTableId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        select.addEventListener('change', this.handleTableSelectorChange);
        leftDiv.appendChild(select);

        if (currentTable) {
            const count = document.createElement('span');
            count.className = 'badge-count';
            count.textContent = `${currentTable.rowCount()} rows · ${currentTable.properties.length} cols`;
            leftDiv.appendChild(count);
        }

        const addRowBtn = document.createElement('button');
        addRowBtn.className = 'btn btn-success btn-sm';
        addRowBtn.textContent = '+ Instance';
        addRowBtn.addEventListener('click', this.handleAddInstance);
        leftDiv.appendChild(addRowBtn);

        header.appendChild(leftDiv);

        const rightDiv = document.createElement('div');
        rightDiv.className = 'tableview-header-right';

        const addColGroup = document.createElement('div');
        addColGroup.className = 'add-column-group';

        const colNameInput = document.createElement('input');
        colNameInput.type = 'text';
        colNameInput.placeholder = 'col name';
        colNameInput.id = 'newColName';
        colNameInput.size = 10;

        const colTypeSelect = document.createElement('select');
        colTypeSelect.id = 'newColType';
        ['string', 'number', 'boolean', 'array', 'link'].forEach(type => {
            const opt = document.createElement('option');
            opt.value = type;
            opt.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            colTypeSelect.appendChild(opt);
        });

        const colTargetSelect = document.createElement('select');
        colTargetSelect.id = 'newColTarget';
        colTargetSelect.style.display = 'none';
        colTargetSelect.style.width = '120px';
        const allTables = Object.values(this.model.tables);
        const currentTableId = this.model.currentTableId;
        allTables.forEach(table => {
            if (table.id !== currentTableId) {
                const opt = document.createElement('option');
                opt.value = table.id;
                opt.textContent = table.name;
                colTargetSelect.appendChild(opt);
            }
        });
        if (colTargetSelect.options.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No other tables';
            opt.disabled = true;
            colTargetSelect.appendChild(opt);
        }

        colTypeSelect.addEventListener('change', () => {
            if (colTypeSelect.value === 'link') {
                colTargetSelect.style.display = 'inline-block';
            } else {
                colTargetSelect.style.display = 'none';
            }
        });

        const addColBtn = document.createElement('button');
        addColBtn.className = 'btn btn-primary btn-sm';
        addColBtn.textContent = '+ Column';
        addColBtn.addEventListener('click', () => {
            this.handleAddColumn(colNameInput, colTypeSelect, colTargetSelect);
        });

        addColGroup.appendChild(colNameInput);
        addColGroup.appendChild(colTypeSelect);
        addColGroup.appendChild(colTargetSelect);
        addColGroup.appendChild(addColBtn);
        rightDiv.appendChild(addColGroup);

        header.appendChild(rightDiv);
        this.container.appendChild(header);
    }

    renderTable() {
        const currentTable = this.model.getCurrentTable();
        if (!currentTable) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No tables available. Create one!';
            this.container.appendChild(empty);
            return;
        }

        const propDefs = currentTable.properties;
        const numCols = propDefs.length + 1;

        if (this.columnWidths.length !== numCols) {
            const widths = [40];
            const defaultWidth = Math.max(150, Math.floor(600 / Math.max(1, propDefs.length)));
            for (let i = 0; i < propDefs.length; i++) {
                widths.push(defaultWidth);
            }
            this.columnWidths = widths;
            this.tableWidth = this.columnWidths.reduce((a, b) => a + b, 0);
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        this.table = table;

        const colGroup = document.createElement('colgroup');
        const colDelete = document.createElement('col');
        colDelete.style.width = '40px';
        colDelete.style.minWidth = '40px';
        colDelete.style.maxWidth = '40px';
        colGroup.appendChild(colDelete);

        for (let i = 0; i < propDefs.length; i++) {
            const col = document.createElement('col');
            if (i < propDefs.length - 1) {
                const width = this.columnWidths[i + 1] || 120;
                col.style.width = width + 'px';
                col.style.minWidth = width + 'px';
                col.style.maxWidth = width + 'px';
            } else {
                col.style.width = 'auto';
                col.style.minWidth = '150px';
                col.style.maxWidth = 'none';
            }
            colGroup.appendChild(col);
        }
        table.appendChild(colGroup);
        this.colGroup = colGroup;

        const totalWidth = this.columnWidths.reduce((a, b) => a + b, 0);
        table.style.minWidth = totalWidth + 'px';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        const thDelete = document.createElement('th');
        thDelete.style.minWidth = '40px';
        thDelete.style.maxWidth = '40px';
        thDelete.style.width = '40px';
        thDelete.style.textAlign = 'center';
        thDelete.style.padding = '4px 2px';
        thDelete.style.verticalAlign = 'middle';
        thDelete.style.fontSize = '10px';
        thDelete.style.color = '#94a3b8';
        thDelete.textContent = '✕';
        headerRow.appendChild(thDelete);

        propDefs.forEach((propDef, idx) => {
            const th = document.createElement('th');
            const colIndex = idx + 1;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'col-header-content';

            const typeSpan = document.createElement('span');
            typeSpan.className = 'col-type';
            let typeLabel = propDef.type;
            if (propDef.type === 'link' && propDef.targetTable) {
                const targetName = this.model.getTableNameById(propDef.targetTable) || 'unknown';
                typeLabel = `link → ${targetName}`;
            }
            typeSpan.textContent = typeLabel;
            contentDiv.appendChild(typeSpan);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'col-name';
            nameSpan.textContent = propDef.name;
            nameSpan.dataset.propName = propDef.name;
            contentDiv.appendChild(nameSpan);

            // Add double-click to rename
            nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startColumnRename(nameSpan, propDef);
            });




            const deleteWrapper = document.createElement('div');
            deleteWrapper.className = 'col-delete-wrapper';
            const delBtn = document.createElement('button');
            delBtn.className = 'col-delete-btn';
            delBtn.textContent = '✕';
            delBtn.title = `Delete column "${propDef.name}"`;
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete column "${propDef.name}"? This will remove all data in this column.`)) {
                    const table = this.model.getCurrentTable();
                    if (table) {
                        const result = this.model.execute({
                            type: 'DELETE_COLUMN',
                            tableId: table.id,
                            propertyName: propDef.name
                        });
                        if (result.success) {
                            this.columnWidths = [];
                        } else {
                            alert(result.error);
                        }
                    }
                }
            });
            deleteWrapper.appendChild(delBtn);
            contentDiv.appendChild(deleteWrapper);

            th.appendChild(contentDiv);
            th.dataset.colIndex = colIndex;

            if (idx < propDefs.length - 1) {
                const resizer = document.createElement('div');
                resizer.className = 'resizer';
                resizer.dataset.colIndex = colIndex;
                resizer.addEventListener('mousedown', this.handleResizeStart);
                th.appendChild(resizer);
            }

            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const instances = currentTable.instances;

        if (instances.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.setAttribute('colspan', propDefs.length + 1);
            emptyCell.className = 'empty-state';
            emptyCell.textContent = '✨ No rows yet. Click "+ Instance" to add one.';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        }
        else {
            instances.forEach((row, rowIndex) => {
                const tr = document.createElement('tr');

                const tdDelete = document.createElement('td');
                tdDelete.className = 'row-delete-cell';
                const delBtn = document.createElement('button');
                delBtn.className = 'row-delete-btn';
                delBtn.textContent = '✕';
                delBtn.title = 'Delete row';
                delBtn.addEventListener('click', () => {
                    if (confirm(`Delete row ${rowIndex + 1}?`)) {
                        const table = this.model.getCurrentTable();
                        if (table) {
                            const instance = table.instances[rowIndex];
                            if (instance) {
                                const result = this.model.execute({
                                    type: 'DELETE_INSTANCE',
                                    tableId: table.id,
                                    instanceId: instance.id
                                });
                                if (!result.success) {
                                    alert(result.error);
                                }
                            }
                        }
                    }
                });
                tdDelete.appendChild(delBtn);
                tr.appendChild(tdDelete);

                propDefs.forEach((propDef) => {
                    const td = document.createElement('td');
                    td.className = 'editable-cell';
                    td.dataset.rowIndex = rowIndex;
                    td.dataset.propName = propDef.name;

                    const value = row[propDef.name] !== undefined ? row[propDef.name] : currentTable.getDefaultForType(propDef.type);

                    const contentSpan = document.createElement('span');
                    contentSpan.className = 'cell-content';
                    contentSpan.innerHTML = this.formatValue(value, propDef);
                    td.appendChild(contentSpan);
                    td.dataset.rawValue = JSON.stringify(value);

                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
            });
        }

        table.appendChild(tbody);
        this.container.appendChild(table);

        this.container.querySelectorAll('.editable-cell').forEach(cell => {
            cell.addEventListener('dblclick', this.handleDoubleClick);
        });

        this.container.querySelectorAll('tr').forEach(tr => {
            tr.addEventListener('mouseenter', () => {
                const firstTd = tr.querySelector('td:first-child');
                if (firstTd) firstTd.style.background = '#f6faff';
            });
            tr.addEventListener('mouseleave', () => {
                const firstTd = tr.querySelector('td:first-child');
                if (firstTd) firstTd.style.background = 'white';
            });
        });
    }

    startColumnRename(labelElement, propDef) {
        if (this.editingColumn) return;
        
        const currentName = propDef.name;
        const content = labelElement.closest('.col-header-content');
        if (!content) return;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'column-name-editor';
        input.value = currentName;
        input.dataset.propName = propDef.name;
        
        labelElement.style.display = 'none';
        content.insertBefore(input, labelElement);
        
        input.focus();
        input.select();
        
        this.editingColumn = {
            labelElement: labelElement,
            inputElement: input,
            propDef: propDef,
            originalValue: currentName,
            isFinished: false  // ← Add this flag
        };
        
        input.addEventListener('blur', () => {
            this.finishColumnRename(false);
        });
        
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
        
        // Prevent double execution
        if (this.editingColumn.isFinished) return;
        this.editingColumn.isFinished = true;
        
        const { labelElement, inputElement, propDef, originalValue } = this.editingColumn;
        
        let newName = originalValue;
        if (!cancel) {
            const value = inputElement.value.trim();
            if (value && value !== originalValue) {
                const table = this.model.getCurrentTable();
                if (table) {
                    // Check if column name already exists (excluding itself)
                    const exists = table.properties.some(p => p.name === value && p.name !== originalValue);
                    if (exists) {
                        alert(`Column "${value}" already exists.`);
                        // Reset flag so user can try again
                        this.editingColumn.isFinished = false;
                        // Keep editing
                        inputElement.focus();
                        inputElement.select();
                        return;
                    }
                    
                    const result = this.model.execute({
                        type: 'RENAME_COLUMN',
                        tableId: table.id,
                        oldName: originalValue,
                        newName: value
                    });
                    
                    if (result.success) {
                        newName = value;
                        labelElement.textContent = value;
                        labelElement.dataset.propName = value;
                        propDef.name = value;
                        this.columnWidths = [];
                    } else {
                        alert(`Failed to rename: ${result.error}`);
                    }
                }
            }
        }
        
        inputElement.remove();
        labelElement.style.display = '';
        this.editingColumn = null;
    }
    
    formatValue(value, propDef) {
        if (value === null || value === undefined || value === '') {
            return '<span class="empty-value">—</span>';
        }
        switch (propDef.type) {
            case 'array':
                if (!Array.isArray(value)) return String(value);
                if (value.length === 0) return '<span class="empty-value">[]</span>';
                return value.map(item =>
                    `<span class="array-badge">${String(item)}</span>`
                ).join(' ');
            case 'boolean':
                return value ? '✔ true' : '✘ false';
            case 'link':
                if (propDef.targetTable) {
                    const displayName = this.model.getDisplayNameForLink(value, propDef.targetTable);
                    if (displayName) {
                        return `<span class="link-badge">🔗 ${displayName} <span class="link-uuid">(${value})</span></span>`;
                    }
                }
                return `<span class="link-badge">🔗 ${String(value)}</span>`;
            default:
                return String(value);
        }
    }

    // ----- Event Handlers -----
    handleTableSelectorChange(e) {
        const tableId = e.target.value;
        if (this.model.switchTable(tableId)) {
            this.columnWidths = [];
        }
    }

    handleAddInstance() {
        const table = this.model.getCurrentTable();
        if (table) {
            this.model.execute({
                type: 'ADD_INSTANCE',
                tableId: table.id,
                data: table.createDefaultRow()
            });
        }
    }

    handleAddColumn(colNameInput, colTypeSelect, colTargetSelect) {
        const name = colNameInput.value.trim();
        const type = colTypeSelect.value;
        if (!name) {
            alert('Please enter a column name.');
            return;
        }
        const table = this.model.getCurrentTable();
        if (table) {
            const property = { name, type };
            if (type === 'link') {
                const targetTable = colTargetSelect.value;
                if (!targetTable) {
                    alert('Please select a target table for the link column.');
                    return;
                }
                property.targetTable = targetTable;
            }
            const result = this.model.execute({
                type: 'ADD_COLUMN',
                tableId: table.id,
                property: property
            });
            if (result.success) {
                colNameInput.value = '';
                this.columnWidths = [];
            } else {
                alert(result.error);
            }
        }
    }

    // ----- Editing -----
    handleDoubleClick(e) {
        const cell = e.currentTarget;
        if (this.editingCell) {
            this.finishEditing(true);
        }
        const rowIndex = parseInt(cell.dataset.rowIndex, 10);
        const propName = cell.dataset.propName;
        const rawValue = cell.dataset.rawValue ? JSON.parse(cell.dataset.rawValue) : undefined;
        const currentTable = this.model.getCurrentTable();
        if (!currentTable) return;
        const propDef = currentTable.getProperty(propName);
        if (!propDef) return;
        const type = propDef.type;
        let currentValue = (rawValue !== undefined) ? rawValue : currentTable.getDefaultForType(type);

        const contentSpan = cell.querySelector('.cell-content');
        if (contentSpan) contentSpan.remove();

        let input;

        if (type === 'boolean') {
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
        } else if (type === 'array') {
            input = document.createElement('input');
            input.type = 'text';
            input.value = Array.isArray(currentValue) ? JSON.stringify(currentValue) : String(currentValue);
        } else if (type === 'link') {
            input = document.createElement('select');
            const targetTable = this.model.getTable(propDef.targetTable);

            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '— Select —';
            input.appendChild(emptyOpt);

            if (targetTable) {
                targetTable.instances.forEach(instance => {
                    const opt = document.createElement('option');
                    const displayName = this.model.getDisplayNameForInstance(targetTable.id, instance.id);
                    opt.value = instance.id;
                    opt.textContent = displayName ? `${displayName} (${instance.id})` : instance.id;
                    if (currentValue === instance.id) {
                        opt.selected = true;
                    }
                    input.appendChild(opt);
                });
            }
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.value = String(currentValue);
        }

        input.className = 'cell-editor';
        input.dataset.rowIndex = rowIndex;
        input.dataset.propName = propName;
        cell.appendChild(input);
        input.focus();

        if (input.type !== 'select-one') {
            input.select();
        }

        this.editingCell = { rowIndex, propName, inputElement: input, originalValue: currentValue, cellElement: cell };
        input.addEventListener('blur', this.handleBlur);
        input.addEventListener('keydown', this.handleKeyDown);
    }

    handleBlur(e) {
        const input = e.currentTarget;
        if (!this.editingCell || this.editingCell.inputElement !== input) return;
        this.finishEditing(false);
    }

    handleKeyDown(e) {
        if (!this.editingCell) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            this.finishEditing(false);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.finishEditing(true);
        }
    }

    finishEditing(cancel = false) {
        if (!this.editingCell) return;
        const { rowIndex, propName, inputElement, cellElement, originalValue } = this.editingCell;
        inputElement.removeEventListener('blur', this.handleBlur);
        inputElement.removeEventListener('keydown', this.handleKeyDown);
        let newValue = originalValue;
        if (!cancel) {
            const raw = inputElement.value;
            const currentTable = this.model.getCurrentTable();
            if (currentTable) {
                const propDef = currentTable.getProperty(propName);
                if (propDef) {
                    try {
                        let coerced;
                        if (propDef.type === 'boolean') coerced = raw === 'true';
                        else if (propDef.type === 'array') {
                            try { const parsed = JSON.parse(raw); coerced = Array.isArray(parsed) ? parsed : [parsed]; }
                            catch (_) { coerced = raw.split(',').map(s => s.trim()).filter(Boolean); }
                        } else if (propDef.type === 'number') {
                            const num = Number(raw);
                            coerced = isNaN(num) ? 0 : num;
                        } else if (propDef.type === 'link') {
                            coerced = raw || null;
                        } else {
                            coerced = String(raw);
                        }

                        const instance = currentTable.instances[rowIndex];
                        if (instance) {
                            const result = this.model.execute({
                                type: 'UPDATE_CELL',
                                tableId: currentTable.id,
                                instanceId: instance.id,
                                property: propName,
                                value: coerced
                            });
                            if (result.success) {
                                newValue = currentTable.instances[rowIndex][propName];
                            } else {
                                alert(`Failed to update: ${result.error}`);
                                newValue = originalValue;
                            }
                        }
                    } catch (_) {
                        newValue = originalValue;
                    }
                }
            }
        }
        inputElement.remove();
        const currentTable = this.model.getCurrentTable();
        if (currentTable) {
            const propDef = currentTable.getProperty(propName);
            if (propDef) {
                const displayValue = (cancel || newValue === undefined) ? originalValue : newValue;
                const contentSpan = document.createElement('span');
                contentSpan.className = 'cell-content';
                contentSpan.innerHTML = this.formatValue(displayValue, propDef);
                cellElement.appendChild(contentSpan);
                cellElement.dataset.rawValue = JSON.stringify(displayValue);
            }
        }
        this.editingCell = null;
    }

    // ----- Resizing -----
    handleResizeStart(e) {
        e.preventDefault();
        const resizer = e.currentTarget;
        const th = resizer.closest('th');
        if (!th) return;
        const colIndex = parseInt(resizer.dataset.colIndex, 10);
        const col = this.colGroup.children[colIndex];
        if (!col) return;

        const startX = e.clientX;
        const startWidth = this.columnWidths[colIndex] || col.offsetWidth || 120;

        this.resizeData = {
            colIndex,
            startX,
            startWidth,
            col,
            resizer,
            tableWidth: this.table.offsetWidth || this.tableWidth
        };
        resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    handleResizeMove(e) {
        if (!this.resizeData) return;
        const { colIndex, startX, startWidth, col } = this.resizeData;
        const diff = e.clientX - startX;
        let newWidth = Math.max(150, startWidth + diff);

        const currentTable = this.model.getCurrentTable();
        if (currentTable && colIndex < currentTable.properties.length) {
            this.columnWidths[colIndex] = newWidth;
            col.style.width = newWidth + 'px';
            col.style.minWidth = newWidth + 'px';
            col.style.maxWidth = newWidth + 'px';

            const totalWidth = this.columnWidths.reduce((a, b) => a + b, 0);
            this.table.style.minWidth = totalWidth + 'px';
            this.tableWidth = totalWidth;
        }
    }

    handleResizeEnd(e) {
        if (this.resizeData) {
            const { resizer } = this.resizeData;
            if (resizer) resizer.classList.remove('active');
            this.resizeData = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        document.removeEventListener('mousemove', this.handleResizeMove);
        document.removeEventListener('mouseup', this.handleResizeEnd);
    }
}