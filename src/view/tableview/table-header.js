import { createElement } from '../dom-utils.js';

export class TableHeader {
    constructor(view) {
        this.view = view;
        this.model = view.model;
        this.cellEditor = view.cellEditor;
    }

    render(table, columns) {
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // Row # header
        const thIdx = document.createElement('th');
        thIdx.textContent = '#';
        thIdx.style.width = '50px';
        thIdx.style.minWidth = '50px';
        thIdx.style.maxWidth = '50px';
        thIdx.style.textAlign = 'center';
        thIdx.style.fontWeight = 'bold';
        headerRow.appendChild(thIdx);

        // Delete column header
        const thDel = document.createElement('th');
        thDel.style.width = '40px';
        thDel.style.minWidth = '40px';
        thDel.style.maxWidth = '40px';
        thDel.style.textAlign = 'center';
        thDel.style.fontSize = '10px';
        thDel.style.color = '#94a3b8';
        thDel.textContent = '✕';
        headerRow.appendChild(thDel);

        // Data column headers
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

            // Column name (double-click to rename)
            const nameSpan = document.createElement('span');
            nameSpan.className = 'col-name';
            nameSpan.textContent = col.name;
            nameSpan.dataset.columnName = col.name;
            nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.cellEditor.startColumnRename(nameSpan, col);
            });
            contentDiv.appendChild(nameSpan);

            // Delete column button (hover)
            const delBtn = document.createElement('button');
            delBtn.className = 'col-delete-btn';
            delBtn.textContent = '✕';
            delBtn.title = `Delete column "${col.name}"`;
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const result = this.model.execute({
                    type: 'DELETE_COLUMN',
                    tableUuid: this.view.currentTableUuid,
                    columnName: col.name
                });
                if (result.success) {
                    this.view.columnWidths = {};
                } else {
                    console.error('[TableHeader] Failed to delete column:', result.error);
                }
            });
            const wrapper = document.createElement('div');
            wrapper.className = 'col-delete-wrapper';
            wrapper.appendChild(delBtn);
            contentDiv.appendChild(wrapper);

            th.appendChild(contentDiv);
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);
        return thead;
    }
}
