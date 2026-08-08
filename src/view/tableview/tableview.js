import { Toolbar } from './toolbar.js';
import { TableHeader } from './table-header.js';
import { TableBody } from './table-body.js';
import { CellEditor } from './cell-editor.js';

export class TableView {
    constructor(container, model) {
        this.container = container;
        this.model = model;
        this.currentTableUuid = null;
        this.columnWidths = {};

        this.cellEditor = new CellEditor(this);
        this.toolbar = new Toolbar(this);
        this.tableHeader = new TableHeader(this);
        this.tableBody = new TableBody(this);

        this.table = null;
        this.colGroup = null;
        this.scrollWrapper = null;

        // Subscribe to model changes
        this.unsubscribe = model.subscribe(() => {
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
        this.container.replaceChildren();
        this.table = null;
        this.colGroup = null;
        this.scrollWrapper = null;

        // Toolbar
        const toolbarEl = this.toolbar.render();
        this.container.appendChild(toolbarEl);

        // Table
        this.renderTable();

        // Ensure container has proper flex
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.overflow = 'hidden';
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

        // Scroll wrapper
        this.scrollWrapper = document.createElement('div');
        this.scrollWrapper.className = 'table-scroll-wrapper';
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

        // Row delete column
        const delCol = document.createElement('col');
        delCol.style.width = '40px';
        delCol.style.minWidth = '40px';
        delCol.style.maxWidth = '40px';
        this.colGroup.appendChild(delCol);

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
        const thead = this.tableHeader.render(table, columns);
        table.appendChild(thead);

        // Tbody
        const tbody = this.tableBody.render(currentTable, columns, rows);
        table.appendChild(tbody);

        this.scrollWrapper.appendChild(table);
    }

    // ----- Format Helpers -----
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

    // ----- Row Commands -----
    handleAddRow() {
        const table = this.model.getTable(this.currentTableUuid);
        if (!table) return;

        for (const col of table.columns) {
            if (col.type === 'link') {
                const targetTable = this.model.getTable(col.targetTable);
                if (!targetTable || targetTable.rows.length === 0) {
                    console.warn(`[TableView] Cannot add row: "${col.name}" has no valid target`);
                    return;
                }
            }
        }

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

        if (!rowData.name) {
            rowData.name = `no_name_${nextIdx}`;
        }

        const result = this.model.execute({
            type: 'ADD_ROW',
            tableUuid: this.currentTableUuid,
            data: rowData
        });

        if (!result.success) {
            console.error('[TableView] Failed to add row:', result.error);
        }
    }

    // ----- Table Commands -----
    handleAddTable() {
        const existingNames = this.model.getTableNames();
        let counter = 1;
        let newName = `Table_${counter}`;
        while (existingNames.includes(newName)) {
            counter++;
            newName = `Table_${counter}`;
        }

        const result = this.model.execute({
            type: 'ADD_TABLE',
            name: newName,
            columns: [{ name: 'name', type: 'string' }],
            rows: []
        });

        if (result.success) {
            this.currentTableUuid = result.tableUuid;
            this.columnWidths = {};
        } else {
            console.error('[TableView] Failed to add table:', result.error);
        }
    }

    handleRenameTable() {
        const table = this.model.getTable(this.currentTableUuid);
        if (!table) return;

        const newName = prompt('Enter new table name:', table.name);
        if (!newName || newName === table.name) return;

        const result = this.model.execute({
            type: 'RENAME_TABLE',
            tableUuid: this.currentTableUuid,
            newName: newName
        });

        if (!result.success) {
            console.error('[TableView] Failed to rename table:', result.error);
        }
    }

    handleDeleteTable() {
        const table = this.model.getTable(this.currentTableUuid);
        if (!table) return;

        if (Object.keys(this.model.tables).length === 1) {
            console.warn('[TableView] Cannot delete the last table');
            return;
        }

        const result = this.model.execute({
            type: 'DELETE_TABLE',
            tableUuid: this.currentTableUuid
        });

        if (result.success) {
            const names = this.model.getTableNames();
            if (names.length > 0) {
                const first = this.model.getTableByName(names[0]);
                if (first) {
                    this.currentTableUuid = first.uuid;
                }
            }
            this.columnWidths = {};
        } else {
            console.error('[TableView] Failed to delete table:', result.error);
        }
    }

    // ----- Destroy -----
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}
