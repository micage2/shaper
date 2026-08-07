// src/model/model.js
import { Type } from './type.js';
import { generateUUID } from './uuid.js';

export class Model {
    constructor() {
        this.tables = {};
        this.subscribers = [];
    }

    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    notify() {
        this.subscribers.forEach(callback => {
            try {
                callback();
            } catch (e) {
                console.error('Error in subscriber:', e);
            }
        });
    }

    // ----- Table Operations -----

    addTable(name, columns = [], rows = []) {
        if (Object.values(this.tables).find(t => t.name === name)) {
            return false;
        }
        const hasName = columns.some(col => col.name === 'name');
        const allColumns = hasName ? columns : [{ name: 'name', type: 'string' }, ...columns];

        const table = new Type(name, allColumns, rows);
        this.tables[table.uuid] = table;
        this.notify();
        return table.uuid;
    }

    renameTable(tableUuid, newName) {
        const table = this.getTable(tableUuid);
        if (!table) return { success: false, error: 'Table not found' };
        if (Object.values(this.tables).some(t => t.name === newName && t.uuid !== tableUuid)) {
            return { success: false, error: 'Table name already exists' };
        }
        table.name = newName;
        this.notify();
        return { success: true };
    }

    getTable(uuid) {
        return this.tables[uuid] || null;
    }

    getTableByName(name) {
        return Object.values(this.tables).find(t => t.name === name);
    }

    getTableNames() {
        return Object.values(this.tables).map(t => t.name);
    }

    getTableUuidByName(name) {
        const table = this.getTableByName(name);
        return table ? table.uuid : null;
    }

    getTableNameByUuid(uuid) {
        const table = this.getTable(uuid);
        return table ? table.name : null;
    }

    // ----- Link Resolution -----

    resolveLink(tableUuid, rowIndex) {
        const table = this.getTable(tableUuid);
        if (!table) return null;
        return table.getRow(rowIndex);
    }

    getDisplayNameForLink(tableUuid, rowIndex) {
        const row = this.resolveLink(tableUuid, rowIndex);
        return row ? (row.name || String(rowIndex)) : null;
    }

    // ----- Tree Helpers -----

    getAllRows() {
        const all = [];
        for (const [tableUuid, table] of Object.entries(this.tables)) {
            for (const row of table.rows) {
                all.push({
                    ...row,
                    _tableUuid: tableUuid,
                    _tableName: table.name,
                    _type: table.name
                });
            }
        }
        return all;
    }

    findChildren(tableUuid, rowIdx) {
        const children = [];
        for (const [childTableUuid, childTable] of Object.entries(this.tables)) {
            const linkCols = childTable.columns.filter(col =>
                col.type === 'link' && col.targetTable === tableUuid
            );
            for (const row of childTable.rows) {
                for (const col of linkCols) {
                    if (row[col.name] === rowIdx) {
                        children.push({
                            ...row,
                            _tableUuid: childTableUuid,
                            _tableName: childTable.name,
                            _type: childTable.name
                        });
                        break;
                    }
                }
            }
        }
        return children;
    }

    getRootRows() {
        const all = this.getAllRows();
        const hasParent = new Set();

        for (const [tableUuid, table] of Object.entries(this.tables)) {
            const linkCols = table.columns.filter(col => col.type === 'link');
            for (const row of table.rows) {
                for (const col of linkCols) {
                    if (row[col.name] !== null && row[col.name] !== undefined) {
                        hasParent.add(row._idx);
                        break;
                    }
                }
            }
        }

        return all.filter(row => !hasParent.has(row._idx));
    }

    hasChildren(tableUuid, rowIdx) {
        return this.findChildren(tableUuid, rowIdx).length > 0;
    }

    // ----- Serialization -----

    toJSON() {
        const result = { tables: [] };

        for (const [tableUuid, table] of Object.entries(this.tables)) {
            const remap = {};
            table.rows.forEach((row, newIdx) => {
                remap[row._idx] = newIdx;
            });

            result.tables.push({
                uuid: table.uuid,
                name: table.name,
                columns: table.columns.map(col => ({
                    name: col.name,
                    type: col.type,
                    targetTable: col.type === 'link' ? col.targetTable : undefined
                })),
                rows: table.rows.map((row) => {
                    const { _idx, _uuid, ...userData } = row;
                    const remappedRow = {};
                    for (const [key, value] of Object.entries(userData)) {
                        const col = table.getColumn(key);
                        if (col && col.type === 'link' && value !== null && value !== undefined) {
                            remappedRow[key] = remap[value] !== undefined ? remap[value] : null;
                        } else {
                            remappedRow[key] = value;
                        }
                    }
                    return remappedRow;
                })
            });
        }

        return result;
    }

    fromJSON(obj) {
        try {
            const data = typeof obj === 'string' ? JSON.parse(obj) : obj;
            if (!data.tables) {
                return { success: false, error: 'Invalid format: missing "tables" array' };
            }

            this.tables = {};

            // First pass: create tables
            const tableUuidMap = {};
            for (const tableDef of data.tables) {
                const uuid = tableDef.uuid || generateUUID();
                const hasName = (tableDef.columns || []).some(col => col.name === 'name');
                const columns = hasName ? tableDef.columns : [{ name: 'name', type: 'string' }, ...(tableDef.columns || [])];

                const table = new Type(tableDef.name, columns, []);
                table.uuid = uuid;
                this.tables[uuid] = table;
                tableUuidMap[tableDef.name] = uuid;
            }

            // Resolve link targets
            for (const [tableName, tableUuid] of Object.entries(tableUuidMap)) {
                const table = this.getTable(tableUuid);
                for (const col of table.columns) {
                    if (col.type === 'link' && col.targetTable) {
                        if (!this.tables[col.targetTable]) {
                            console.warn(`[Import] Target table UUID "${col.targetTable}" not found`);
                            col.targetTable = null;
                        }
                    }
                }
            }

            // Second pass: insert rows
            for (const tableDef of data.tables) {
                const tableUuid = tableDef.uuid || tableUuidMap[tableDef.name];
                const table = this.getTable(tableUuid);
                if (!table) continue;

                for (const rowData of (tableDef.rows || [])) {
                    const data = { ...rowData };
                    if (!data.name) data.name = 'Unnamed';
                    const result = table.insertRow(data);
                    if (!result.success) {
                        console.warn(`[Import] Failed to insert row:`, result.error);
                    }
                }
            }

            // Third pass: validate links
            for (const [tableName, tableUuid] of Object.entries(tableUuidMap)) {
                const table = this.getTable(tableUuid);
                for (const row of table.rows) {
                    for (const col of table.columns) {
                        if (col.type === 'link' && row[col.name] !== null && row[col.name] !== undefined) {
                            const targetTable = this.getTable(col.targetTable);
                            if (targetTable) {
                                const targetRow = targetTable.getRow(row[col.name]);
                                if (!targetRow) {
                                    console.warn(`[Import] Invalid link: row ${row[col.name]} not found`);
                                    row[col.name] = null;
                                }
                            }
                        }
                    }
                }
            }

            this.notify();

            return {
                success: true,
                tableCount: Object.keys(this.tables).length,
                rowCount: Object.values(this.tables).reduce((sum, t) => sum + t.rows.length, 0)
            };

        } catch (e) {
            console.error('[Import] Error:', e);
            return { success: false, error: e.message };
        }
    }

    // ----- Command System -----

    execute(command) {
        if (!command || typeof command !== 'object' || !command.type) {
            return { success: false, error: 'Invalid command' };
        }

        let result;
        switch (command.type) {
            case 'UPDATE_CELL':
                result = this._handleUpdateCell(command);
                break;
            case 'ADD_ROW':
                result = this._handleAddRow(command);
                break;
            case 'DELETE_ROW':
                result = this._handleDeleteRow(command);
                break;
            case 'ADD_TABLE':
                result = this._handleAddTable(command);
                break;
            case 'DELETE_TABLE':
                result = this._handleDeleteTable(command);
                break;
            case 'RENAME_TABLE':
                result = this._handleRenameTable(command);
                break;
            case 'ADD_COLUMN':
                result = this._handleAddColumn(command);
                break;
            case 'DELETE_COLUMN':
                result = this._handleDeleteColumn(command);
                break;
            case 'RENAME_COLUMN':
                result = this._handleRenameColumn(command);
                break;
            default:
                return { success: false, error: `Unknown command: ${command.type}` };
        }

        if (result && result.success) {
            this.notify();
        }
        return result || { success: false, error: 'Command failed' };
    }

    // ----- Command Handlers -----

    _handleUpdateCell(command) {
        const { tableUuid, rowIdx, columnName, value } = command;
        const table = this.getTable(tableUuid);
        if (!table) return { success: false, error: 'Table not found' };

        const col = table.getColumn(columnName);
        if (!col) return { success: false, error: 'Column not found' };

        if (col.type === 'link' && (value === null || value === undefined || value === '')) {
            return { success: false, error: `Column "${columnName}" cannot be null` };
        }

        const result = table.updateCell(rowIdx, columnName, value);
        if (!result.success) return result;
        return { success: true };
    }

    _handleAddRow(command) {
        const { tableUuid, data = {} } = command;
        const table = this.getTable(tableUuid);
        if (!table) return { success: false, error: 'Table not found' };

        // Check if all link columns have valid targets
        for (const col of table.columns) {
            if (col.type === 'link') {
                const targetTable = this.getTable(col.targetTable);
                if (!targetTable || targetTable.rows.length === 0) {
                    console.error(`[Model] Cannot add row: target table "${col.targetTable}" has no rows`);
                    return { success: false, error: `Column "${col.name}" has no valid target` };
                }
            }
        }

        // Build row data with defaults
        const rowData = { ...data };
        for (const col of table.columns) {
            if (col.type === 'link' && rowData[col.name] === undefined) {
                const targetTable = this.getTable(col.targetTable);
                rowData[col.name] = targetTable.rows[0]._idx;
            } else if (rowData[col.name] === undefined) {
                if (col.type === 'string') rowData[col.name] = '';
                else if (col.type === 'number') rowData[col.name] = 0;
                else if (col.type === 'boolean') rowData[col.name] = true;
                else if (col.type === 'array') rowData[col.name] = [];
            }
        }

        // Ensure name exists
        if (!rowData.name) {
            rowData.name = `no_name_${table.rows.length}`;
        }

        const result = table.insertRow(rowData);
        if (!result.success) return result;
        return { success: true, rowIdx: result.rowIdx };
    }

    _handleDeleteRow(command) {
        const { tableUuid, rowIdx } = command;
        const table = this.getTable(tableUuid);
        if (!table) return { success: false, error: 'Table not found' };

        // Cascade delete: find and delete all children
        const children = this.findChildren(tableUuid, rowIdx);
        if (children.length > 0) {
            console.warn(`[Model] Deleting parent row #${rowIdx} — ${children.length} children will be deleted`);
            for (const child of children) {
                const childTable = this.getTable(child._tableUuid);
                if (childTable) {
                    const result = childTable.deleteRow(child._idx);
                    if (!result.success) {
                        console.warn(`[Model] Failed to delete child row ${child._idx}:`, result.error);
                    }
                }
            }
        }

        const result = table.deleteRow(rowIdx);
        if (!result.success) return result;
        return { success: true };
    }

    _handleAddTable(command) {
        const { name, columns = [], rows = [] } = command;
        if (Object.values(this.tables).find(t => t.name === name)) {
            return { success: false, error: `Table "${name}" already exists` };
        }

        const uuid = this.addTable(name, columns, rows);
        if (!uuid) return { success: false, error: 'Failed to add table' };
        return { success: true, tableUuid: uuid };
    }

    _handleDeleteTable(command) {
        const { tableUuid } = command;
        const table = this.getTable(tableUuid);
        if (!table) return { success: false, error: 'Table not found' };
        if (Object.keys(this.tables).length === 1) {
            return { success: false, error: 'Cannot delete the last table' };
        }

        // Find all child tables that link to this table
        const childTables = [];
        for (const [id, t] of Object.entries(this.tables)) {
            if (id === tableUuid) continue;
            const linkCols = t.findLinkColumnsReferencing(tableUuid);
            if (linkCols.length > 0) {
                childTables.push(t);
            }
        }

        // Cascade delete: delete all rows in child tables
        for (const childTable of childTables) {
            while (childTable.rows.length > 0) {
                const row = childTable.rows[0];
                const result = this._handleDeleteRow({
                    tableUuid: childTable.uuid,
                    rowIdx: row._idx
                });
                if (!result.success) {
                    console.warn(`[Model] Failed to delete child row ${row._idx}:`, result.error);
                }
            }
        }

        // Delete the table
        delete this.tables[tableUuid];
        return { success: true };
    }

    _handleRenameTable(command) {
        const { tableUuid, newName } = command;
        const result = this.renameTable(tableUuid, newName);
        if (!result.success) return result;
        return { success: true };
    }

    _handleAddColumn(command) {
        const { tableUuid, column } = command;
        const table = this.getTable(tableUuid);
        if (!table) return { success: false, error: 'Table not found' };

        if (column.type === 'link' && column.targetTable) {
            const targetTable = this.getTable(column.targetTable);
            if (!targetTable) return { success: false, error: 'Target table not found' };
        }

        const result = table.addColumn(column);
        if (!result.success) return result;
        return { success: true };
    }

    _handleDeleteColumn(command) {
        const { tableUuid, columnName } = command;
        const table = this.getTable(tableUuid);
        if (!table) return { success: false, error: 'Table not found' };

        const result = table.deleteColumn(columnName);
        if (!result.success) return result;
        return { success: true };
    }

    _handleRenameColumn(command) {
        const { tableUuid, oldName, newName } = command;
        const table = this.getTable(tableUuid);
        if (!table) return { success: false, error: 'Table not found' };

        const result = table.renameColumn(oldName, newName);
        if (!result.success) return result;
        return { success: true };
    }
}