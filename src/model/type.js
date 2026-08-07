import { generateUUID } from './uuid.js';

export class Type {
    constructor(name, columns = [], rows = []) {
        this.uuid = generateUUID();
        this.name = name;

        this.columns = columns.map(col => ({
            name: col.name,
            type: col.type || 'string',
            targetTable: col.targetTable || null
        }));

        this.rows = [];
        this._nextIdx = 0;

        for (const row of rows) {
            this.insertRow(row);
        }
    }

    // ----- Row Operations -----
    insertRow(rowData) {
        // Validate: all link columns must have a value
        for (const col of this.columns) {
            for (const col of this.columns) {
                if (col.type === 'link') {
                    const value = rowData[col.name];
                    if (value === null || value === undefined || value === '') {
                        console.error(`[Table: "${this.name}"] Cannot insert row: link column "${col.name}" cannot be null or empty`);
                        return { success: false, error: `Column "${col.name}" cannot be null` };
                    }
                }
            }
        }

        const idx = this._nextIdx++;
        const newRow = {
            _idx: idx,
            _uuid: generateUUID()
        };
        for (const [key, value] of Object.entries(rowData)) {
            newRow[key] = value;
        }
        this.rows.push(newRow);
        return { success: true, rowIdx: idx };
    }

    deleteRow(idx) {
        const index = this.rows.findIndex(row => row._idx === idx);
        if (index === -1) {
            console.error(`[Table] Row ${idx} not found in table "${this.name}"`);
            return { success: false, error: 'Row not found' };
        }
        this.rows.splice(index, 1);
        return { success: true };
    }

    getRow(idx) {
        return this.rows.find(row => row._idx === idx) || null;
    }

    updateCell(rowIdx, columnName, value) {
        const row = this.getRow(rowIdx);
        if (!row) {
            console.error(`[Table] Row ${rowIdx} not found in table "${this.name}"`);
            return { success: false, error: 'Row not found' };
        }

        const col = this.getColumn(columnName);
        if (!col) {
            console.error(`[Table] Column "${columnName}" not found in table "${this.name}"`);
            return { success: false, error: 'Column not found' };
        }

        // Validate: link columns cannot be set to null
        if (col.type === 'link') {
            if (value === null || value === undefined || value === '') {
                console.error(`[Table] Cannot set link column "${columnName}" to null in table "${this.name}"`);
                return { success: false, error: `Column "${columnName}" cannot be null` };
            }
        }

        try {
            row[columnName] = this.coerceValue(value, col.type);
            return { success: true };
        } catch (_) {
            console.error(`[Table] Failed to coerce value for column "${columnName}" in table "${this.name}"`);
            return { success: false, error: 'Invalid value' };
        }
    }

    // ----- Column Operations -----

    addColumn(columnDef) {
        if (this.columns.find(col => col.name === columnDef.name)) {
            console.error(`[Table] Column "${columnDef.name}" already exists in table "${this.name}"`);
            return { success: false, error: 'Column already exists' };
        }

        // Link column must have a targetTable
        if (columnDef.type === 'link' && !columnDef.targetTable) {
            console.error(`[Table] Link column "${columnDef.name}" in table "${this.name}" has no targetTable`);
            return { success: false, error: 'Link column must have a targetTable' };
        }

        // Cannot add link column to table with existing rows (would create orphans)
        if (columnDef.type === 'link' && this.rows.length > 0) {
            console.error(`[Table] Cannot add link column "${columnDef.name}" to table "${this.name}" with existing rows`);
            return { success: false, error: 'Cannot add link column to table with existing rows' };
        }

        this.columns.push({
            name: columnDef.name,
            type: columnDef.type || 'string',
            targetTable: columnDef.targetTable || null
        });

        const defaultValue = this.getDefaultForType(columnDef.type || 'string');
        this.rows.forEach(row => {
            row[columnDef.name] = defaultValue;
        });
        return { success: true };
    }

    deleteColumn(columnName) {
        const index = this.columns.findIndex(col => col.name === columnName);
        if (index === -1) {
            console.error(`[Table] Column "${columnName}" not found in table "${this.name}"`);
            return { success: false, error: 'Column not found' };
        }

        const col = this.columns[index];

        // Check if link column is in use
        if (col.type === 'link') {
            for (const row of this.rows) {
                if (row[col.name] !== null && row[col.name] !== undefined) {
                    console.error(`[Table] Cannot delete link column "${columnName}" in table "${this.name}": rows have links to other tables`);
                    return { success: false, error: 'Column is in use' };
                }
            }
        }

        this.columns.splice(index, 1);
        this.rows.forEach(row => {
            delete row[columnName];
        });
        return { success: true };
    }

    renameColumn(oldName, newName) {
        if (this.columns.find(col => col.name === newName)) {
            console.error(`[Table] Column "${newName}" already exists in table "${this.name}"`);
            return { success: false, error: 'Column name already exists' };
        }

        const col = this.getColumn(oldName);
        if (!col) {
            console.error(`[Table] Column "${oldName}" not found in table "${this.name}"`);
            return { success: false, error: 'Column not found' };
        }

        col.name = newName;
        this.rows.forEach(row => {
            if (oldName in row) {
                row[newName] = row[oldName];
                delete row[oldName];
            }
        });
        return { success: true };
    }

    // ----- Getters -----

    getColumn(name) {
        return this.columns.find(col => col.name === name) || null;
    }

    getColumnNames() {
        return this.columns.map(col => col.name);
    }

    findLinkColumnsReferencing(tableUuid) {
        return this.columns.filter(col =>
            col.type === 'link' && col.targetTable === tableUuid
        );
    }

    // ----- Value Helpers -----

    coerceValue(value, type) {
        if (value === null || value === undefined || value === '') {
            return this.getDefaultForType(type);
        }
        switch (type) {
            case 'string': return String(value);
            case 'number': { const num = Number(value); return isNaN(num) ? 0 : num; }
            case 'boolean': {
                if (typeof value === 'boolean') return value;
                if (typeof value === 'string') {
                    const lower = value.toLowerCase();
                    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
                    if (lower === 'false' || lower === '0' || lower === 'no') return false;
                }
                return Boolean(value);
            }
            case 'array': {
                if (Array.isArray(value)) return value.slice();
                if (typeof value === 'string') {
                    try { return JSON.parse(value); } catch (_) { return [value]; }
                }
                return [String(value)];
            }
            case 'link': {
                if (value === null || value === undefined || value === '') return null;
                return Number(value);
            }
            default: return value;
        }
    }

    getDefaultForType(type) {
        switch (type) {
            case 'string': return '';
            case 'number': return 0;
            case 'boolean': return true;
            case 'array': return [];
            case 'link': return null;
            default: return null;
        }
    }

    createDefaultRow() {
        const row = {};
        for (const col of this.columns) {
            // Link columns cannot have a default value
            if (col.type === 'link') {
                console.error(`[Table] Cannot create default row: table "${this.name}" has link column "${col.name}"`);
                return { success: false, error: 'Table has link columns, cannot create default row' };
            }
            row[col.name] = this.getDefaultForType(col.type);
        }
        return { success: true, row: row };
    }

    rowCount() {
        return this.rows.length;
    }
}