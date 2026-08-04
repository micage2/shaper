// src/model.js
import { Type } from "./type.js";

export class Model {
    constructor() {
        this.tables = {};
        this.currentTableId = null;
        this.subscribers = [];
    }

    // ----- Observable Pattern -----
    subscribe(callback) {
        this.subscribers.push(callback);
        // Return unsubscribe function
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

    // ----- Data Methods (with notifications) -----
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

        // Find all link columns referencing this table
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

        // Delete the referencing columns
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

    // ... all other methods (getCurrentTable, getTableNames, getTable, etc.)
    // With notify() calls where needed

    // ----- TreeView Helper Methods -----
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

    // Find instances that link TO a given instance
    findChildren(instanceId, tableId) {
        const children = [];
        const table = this.getTable(tableId);
        if (!table) return children;

        // For each link property on this instance
        const linkProps = table.properties.filter(p => p.type === 'link');
        for (const prop of linkProps) {
            const instance = table.instances.find(inst => inst.id === instanceId);
            if (!instance) continue;

            const linkValue = instance[prop.name];
            if (!linkValue) continue;

            // Find the linked instance
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

    // Find all instances that have NO incoming links (roots)
    getRootInstances() {
        const allInstances = this.getAllInstances();
        const linkedIds = new Set();

        // Collect all instance IDs that are linked to by someone
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

        // Roots = instances that are never linked to
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

    getDisplayNameForInstance(tableId, instanceId) {
        const table = this.getTable(tableId);
        if (!table) return null;

        const instance = table.instances.find(row => row.id === instanceId);
        if (!instance) return null;

        // Try name, then title, then fallback to ID
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
}