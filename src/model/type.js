import { generateUUID } from "./uuid.js";

export class Type {
    constructor(name, properties = [], instances = []) {
        this.id = generateUUID();
        this.name = name;
        this.properties = properties.map(p => ({
            ...p,
            id: p.id || generateUUID()
        }));
        this.instances = instances.map(row => ({
            ...row,
            id: row.id || generateUUID()
        }));
    }

    addInstance(rowData) {
        const newRow = {
            ...rowData,
            id: rowData.id || generateUUID()
        };
        this.instances.push(newRow);
        return newRow.id;
    }

    deleteInstance(rowIndex) {
        if (rowIndex < 0 || rowIndex >= this.instances.length) return false;
        this.instances.splice(rowIndex, 1);
        return true;
    }

    updateCell(rowIndex, propertyName, newValue) {
        if (rowIndex < 0 || rowIndex >= this.instances.length) return false;
        const row = this.instances[rowIndex];
        if (!(propertyName in row)) return false;
        const propDef = this.properties.find(p => p.name === propertyName);
        if (!propDef) return false;
        try {
            row[propertyName] = this.coerceValue(newValue, propDef.type, propDef);
        } catch (_) {
            return false;
        }
        return true;
    }

    coerceValue(value, type, propDef = null) {
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
                if (!value || value === '') return null;
                return String(value);
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

    addColumn(property) {
        if (this.properties.find(p => p.name === property.name)) {
            return false;
        }
        const newProp = {
            ...property,
            id: property.id || generateUUID()
        };
        this.properties.push(newProp);
        const defaultValue = this.getDefaultForType(newProp.type);
        this.instances.forEach(row => {
            row[newProp.name] = defaultValue;
        });
        return true;
    }

    deleteColumn(propertyName) {
        const index = this.properties.findIndex(p => p.name === propertyName);
        if (index === -1) return false;
        this.properties.splice(index, 1);
        this.instances.forEach(row => {
            delete row[propertyName];
        });
        return true;
    }

    deleteColumnById(propertyId) {
        const index = this.properties.findIndex(p => p.id === propertyId);
        if (index === -1) return false;
        const propName = this.properties[index].name;
        this.properties.splice(index, 1);
        this.instances.forEach(row => {
            delete row[propName];
        });
        return true;
    }

    getProperty(name) {
        return this.properties.find(p => p.name === name);
    }

    getPropertyNames() {
        return this.properties.map(p => p.name);
    }

    rowCount() {
        return this.instances.length;
    }

    createDefaultRow() {
        const row = { id: generateUUID() };
        this.properties.forEach(prop => {
            row[prop.name] = this.getDefaultForType(prop.type);
        });
        return row;
    }

    findLinkColumnsReferencing(tableId) {
        return this.properties.filter(p =>
            p.type === 'link' && p.targetTable === tableId
        );
    }
}

