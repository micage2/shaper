import { createElement } from '../dom-utils.js';

export class TableBody {
    constructor(view) {
        this.view = view;
        this.model = view.model;
        this.cellEditor = view.cellEditor;
    }

    render(table, columns, rows) {
        const tbody = document.createElement('tbody');

        if (rows.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.setAttribute('colspan', columns.length + 3);
            emptyCell.className = 'empty-state';
            emptyCell.textContent = '✨ No rows yet. Click "+ Row" to add one.';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
            return tbody;
        }

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

            // Row delete cell
            const tdDel = document.createElement('td');
            tdDel.style.textAlign = 'center';
            tdDel.style.padding = '2px 0';
            tdDel.style.verticalAlign = 'middle';
            const delBtn = document.createElement('button');
            delBtn.className = 'row-delete-btn';
            delBtn.textContent = '✕';
            delBtn.title = 'Delete row and all children';
            delBtn.addEventListener('click', () => {
                const result = this.model.execute({
                    type: 'DELETE_ROW',
                    tableUuid: this.view.currentTableUuid,
                    rowIdx: row._idx
                });
                if (!result.success) {
                    console.error('[TableBody] Failed to delete row:', result.error);
                }
            });
            tdDel.appendChild(delBtn);
            tr.appendChild(tdDel);

            // Data cells
            for (const col of columns) {
                const td = document.createElement('td');
                td.className = 'editable-cell';
                td.dataset.rowIdx = row._idx;
                td.dataset.columnName = col.name;

                const value = row[col.name] !== undefined ? row[col.name] : null;
                const contentSpan = document.createElement('span');
                contentSpan.className = 'cell-content';
                contentSpan.innerHTML = this.view.formatValue(value, col);
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

        return tbody;
    }
}
