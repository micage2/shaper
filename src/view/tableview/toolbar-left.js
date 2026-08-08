import { createElement, createButton, createSelect } from '../dom-utils.js';

export class ToolbarLeft {
    constructor(view) {
        this.view = view;
        this.model = view.model;
        this.container = null;
    }

    render() {
        this.container = createElement('div', { className: 'toolbar-left' });
        this.buildIdle();
        return this.container;
    }

    buildIdle() {
        const currentTable = this.model.getTable(this.view.currentTableUuid);
        
        // Table selector
        const tableNames = this.model.getTableNames();
        const options = tableNames.map(name => {
            const table = this.model.getTableByName(name);
            return { value: table.uuid, label: name };
        });
        
        const select = createSelect(
            options,
            this.view.currentTableUuid,
            'table-selector',
            (e) => {
                this.view.currentTableUuid = e.target.value;
                this.view.columnWidths = {};
                this.view.render();
            }
        );
        this.container.appendChild(select);

        // Row count badge
        if (currentTable) {
            const badge = createElement('span', {
                className: 'badge-count'
            }, `${currentTable.rowCount()} rows · ${currentTable.columns.length} cols`);
            this.container.appendChild(badge);
        }

        // + Row button
        const addRowBtn = createButton('+ Row', 'btn btn-success btn-sm', () => {
            this.view.handleAddRow();
        });
        this.container.appendChild(addRowBtn);

        return this.container;
    }
}