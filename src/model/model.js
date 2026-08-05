// src/model.js
import { Type } from "./type.js";

export class Model {
    constructor() {
        this.tables = {};
        this.currentTableId = null;
        this.subscribers = [];
    }

    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    notify() {
        console.log('📢 Model.notify() called, subscribers:', this.subscribers.length);
        this.subscribers.forEach(callback => {
            try {
                callback();
            } catch (e) {
                console.error('Error in subscriber:', e);
            }
        });
    }

    addTable(name, properties = [], instances = []) {
        if (Object.values(this.tables).find(t => t.name === name)) {
            return false;
        }
        const table = new Type(name, properties, instances);
        this.tables[table.id] = table;
        if (!this.currentTableId) {
            this.currentTableId = table.id;
        }
        this.notify();
        return table.id;
    }

    deleteTable(tableId) {
        if (!this.tables[tableId]) return false;
        if (Object.keys(this.tables).length === 1) return false;

        const referencingColumns = [];
        for (const [id, table] of Object.entries(this.tables)) {
            if (id === tableId) continue;
            const linkCols = table.findLinkColumnsReferencing(tableId);
            linkCols.forEach(col => {
                referencingColumns.push({
                    tableName: table.name,
                    columnName: col.name,
                    columnId: col.id
                });
            });
        }

        for (const [id, table] of Object.entries(this.tables)) {
            if (id === tableId) continue;
            const linkCols = table.findLinkColumnsReferencing(tableId);
            linkCols.forEach(col => {
                table.deleteColumnById(col.id);
            });
        }

        delete this.tables[tableId];

        if (this.currentTableId === tableId) {
            const keys = Object.keys(this.tables);
            this.currentTableId = keys.length > 0 ? keys[0] : null;
        }

        this.notify();
        return { success: true, deletedColumns: referencingColumns };
    }

    getCurrentTable() {
        if (!this.currentTableId || !this.tables[this.currentTableId]) {
            const keys = Object.keys(this.tables);
            if (keys.length > 0) {
                this.currentTableId = keys[0];
            } else {
                return null;
            }
        }
        return this.tables[this.currentTableId];
    }

    getTableNames() {
        return Object.values(this.tables).map(t => t.name);
    }

    getTableIdByName(name) {
        const table = Object.values(this.tables).find(t => t.name === name);
        return table ? table.id : null;
    }

    getTableNameById(id) {
        return this.tables[id] ? this.tables[id].name : null;
    }

    switchTable(tableId) {
        if (this.tables[tableId]) {
            this.currentTableId = tableId;
            this.notify();
            return true;
        }
        return false;
    }

    getTable(id) {
        return this.tables[id];
    }

    getTableByName(name) {
        return Object.values(this.tables).find(t => t.name === name);
    }

    getDisplayNameForInstance(tableId, instanceId) {
        const table = this.getTable(tableId);
        if (!table) return null;

        const instance = table.instances.find(row => row.id === instanceId);
        if (!instance) return null;

        if (instance.name && typeof instance.name === 'string') {
            return instance.name;
        }
        if (instance.title && typeof instance.title === 'string') {
            return instance.title;
        }
        return instanceId;
    }

    getDisplayNameForLink(linkValue, targetTableId) {
        if (!linkValue) return null;
        return this.getDisplayNameForInstance(targetTableId, linkValue);
    }

    // TreeView helper methods
    getAllInstances() {
        const all = [];
        for (const [tableId, table] of Object.entries(this.tables)) {
            table.instances.forEach(instance => {
                all.push({
                    ...instance,
                    _tableId: tableId,
                    _tableName: table.name,
                    _type: table.name
                });
            });
        }
        return all;
    }

    findChildren(instanceId, tableId) {
        const children = [];
        const table = this.getTable(tableId);
        if (!table) return children;

        const linkProps = table.properties.filter(p => p.type === 'link');
        for (const prop of linkProps) {
            const instance = table.instances.find(inst => inst.id === instanceId);
            if (!instance) continue;

            const linkValue = instance[prop.name];
            if (!linkValue) continue;

            const targetTable = this.getTable(prop.targetTable);
            if (!targetTable) continue;

            const targetInstance = targetTable.instances.find(inst => inst.id === linkValue);
            if (targetInstance) {
                children.push({
                    ...targetInstance,
                    _tableId: targetTable.id,
                    _tableName: targetTable.name,
                    _type: targetTable.name,
                    _linkProperty: prop.name
                });
            }
        }
        return children;
    }

    getRootInstances() {
        const allInstances = this.getAllInstances();
        const linkedIds = new Set();

        for (const [tableId, table] of Object.entries(this.tables)) {
            const linkProps = table.properties.filter(p => p.type === 'link');
            for (const instance of table.instances) {
                for (const prop of linkProps) {
                    const linkValue = instance[prop.name];
                    if (linkValue) {
                        linkedIds.add(linkValue);
                    }
                }
            }
        }

        return allInstances.filter(inst => !linkedIds.has(inst.id));
    }

    getDisplayName(instance) {
        if (instance.name && typeof instance.name === 'string') {
            return instance.name;
        }
        if (instance.title && typeof instance.title === 'string') {
            return instance.title;
        }
        return instance.id;
    }

    addInstanceToCurrentTable(rowData) {
        const table = this.getCurrentTable();
        if (!table) return false;
        const result = table.addInstance(rowData);
        this.notify();
        return result;
    }

    addColumnToCurrentTable(property) {
        const table = this.getCurrentTable();
        if (!table) return false;
        const result = table.addColumn(property);
        this.notify();
        return result;
    }

    deleteInstanceFromCurrentTable(rowIndex) {
        const table = this.getCurrentTable();
        if (!table) return false;
        const result = table.deleteInstance(rowIndex);
        this.notify();
        return result;
    }

    deleteColumnFromCurrentTable(propertyName) {
        const table = this.getCurrentTable();
        if (!table) return false;
        const result = table.deleteColumn(propertyName);
        this.notify();
        return result;
    }

    updateCellInCurrentTable(rowIndex, propertyName, value) {
        const table = this.getCurrentTable();
        if (!table) return false;
        const result = table.updateCell(rowIndex, propertyName, value);
        this.notify();
        return result;
    }

    execute(command) {
        // Validate command
        if (!command || typeof command !== 'object' || !command.type) {
            return { success: false, error: 'Invalid command' };
        }

        let result;
        switch (command.type) {
            case 'UPDATE_CELL':
                result = this._handleUpdateCell(command);
                break;
            case 'ADD_INSTANCE':
                result = this._handleAddInstance(command);
                break;
            case 'DELETE_INSTANCE':
                result = this._handleDeleteInstance(command);
                break;
            case 'ADD_COLUMN':
                result = this._handleAddColumn(command);
                break;
            case 'DELETE_COLUMN':
                result = this._handleDeleteColumn(command);
                break;
            case 'RENAME_INSTANCE':
                result = this._handleRenameInstance(command);
                break;
            case 'RENAME_COLUMN':
                result = this._handleRenameColumn(command);
                break;
            default:
                return { success: false, error: `Unknown command: ${command.type}` };
        }

        if (result.success) {
            this.notify();
        }
        return result;
    }

    // ----- Command Handlers -----
    _handleUpdateCell(command) {
        const { tableId, instanceId, property, value } = command;
        const table = this.getTable(tableId);
        if (!table) return { success: false, error: 'Table not found' };

        const propDef = table.getProperty(property);
        if (!propDef) return { success: false, error: 'Property not found' };

        const index = table.instances.findIndex(inst => inst.id === instanceId);
        if (index === -1) return { success: false, error: 'Instance not found' };

        try {
            const coerced = table.coerceValue(value, propDef.type, propDef);

            // Link validation
            if (propDef.type === 'link' && coerced) {
                const targetTable = this.getTable(propDef.targetTable);
                if (targetTable) {
                    const exists = targetTable.instances.some(inst => inst.id === coerced);
                    if (!exists) {
                        return { success: false, error: 'Linked instance not found' };
                    }
                }
            }

            table.instances[index][property] = coerced;
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    _handleAddInstance(command) {
        const { tableId, data = {} } = command;
        const table = this.getTable(tableId);
        if (!table) return { success: false, error: 'Table not found' };

        const row = table.createDefaultRow();
        for (const [key, value] of Object.entries(data)) {
            const propDef = table.getProperty(key);
            if (propDef) {
                row[key] = table.coerceValue(value, propDef.type, propDef);
            }
        }

        const id = table.addInstance(row);
        return { success: true, instanceId: id };
    }

    _handleDeleteInstance(command) {
        const { tableId, instanceId } = command;
        const table = this.getTable(tableId);
        if (!table) return { success: false, error: 'Table not found' };

        const index = table.instances.findIndex(inst => inst.id === instanceId);
        if (index === -1) return { success: false, error: 'Instance not found' };

        table.deleteInstance(index);
        return { success: true };
    }

    _handleAddColumn(command) {
        const { tableId, property } = command;
        const table = this.getTable(tableId);
        if (!table) return { success: false, error: 'Table not found' };

        const result = table.addColumn(property);
        if (!result) return { success: false, error: 'Column already exists' };
        return { success: true };
    }

    _handleDeleteColumn(command) {
        const { tableId, propertyName } = command;
        const table = this.getTable(tableId);
        if (!table) return { success: false, error: 'Table not found' };

        const result = table.deleteColumn(propertyName);
        if (!result) return { success: false, error: 'Column not found' };
        return { success: true };
    }

    _handleRenameInstance(command) {
        const { tableId, instanceId, newName, property = 'name' } = command;
        const table = this.getTable(tableId);
        if (!table) return { success: false, error: 'Table not found' };

        const propDef = table.getProperty(property);
        if (!propDef) return { success: false, error: `Property "${property}" not found` };
        if (propDef.type !== 'string') {
            return { success: false, error: `Property "${property}" is not a string` };
        }

        const index = table.instances.findIndex(inst => inst.id === instanceId);
        if (index === -1) return { success: false, error: 'Instance not found' };

        table.instances[index][property] = String(newName);
        return { success: true };
    }

    _handleRenameColumn(command) {
        const { tableId, oldName, newName } = command;
        const table = this.getTable(tableId);
        if (!table) return { success: false, error: 'Table not found' };
        
        const propDef = table.getProperty(oldName);
        if (!propDef) return { success: false, error: 'Column not found' };
        
        // Check if new name already exists (excluding this column)
        if (table.properties.some(p => p.name === newName && p.name !== oldName)) {
            return { success: false, error: 'Column name already exists' };
        }
        
        // Update the property name
        propDef.name = newName;
        
        // CRITICAL: Update all instances - rename the key in every row
        for (const instance of table.instances) {
            if (oldName in instance) {
                instance[newName] = instance[oldName];
                delete instance[oldName];
            }
        }
        
        return { success: true };
    }    
} // end class Model
