export class TreeView {
    constructor(container, model) {
        this.container = container;
        this.model = model;
        this.selectedInstanceId = null;
        this.selectedTableId = null;
        this.expandedIds = new Set();
        this.onSelect = null;
        this.editingNode = null;

        // Subscribe to model changes
        this.unsubscribe = model.subscribe(() => {
            this.render();
        });

        // Bind methods
        this.handleAddNode = this.handleAddNode.bind(this);
        this.handleDeleteNode = this.handleDeleteNode.bind(this);
        this.handleTypeChange = this.handleTypeChange.bind(this);

        this.render();
    }

    render() {
        const roots = this.model.getRootInstances();

        this.container.innerHTML = '';

        // Render toolbar
        this.renderToolbar();

        if (roots.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'tree-empty';
            empty.textContent = 'No data. Create some instances!';
            this.container.appendChild(empty);
            return;
        }

        const treeContainer = document.createElement('div');
        treeContainer.className = 'tree-container';

        roots.forEach(root => {
            const item = this.createTreeNode(root);
            treeContainer.appendChild(item);
        });

        this.container.appendChild(treeContainer);
    }

    renderToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'tree-toolbar';

        // Type dropdown
        const typeSelect = document.createElement('select');
        typeSelect.className = 'tree-type-select';
        typeSelect.id = 'treeTypeSelect';

        const tableNames = this.model.getTableNames();
        if (tableNames.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No tables';
            opt.disabled = true;
            typeSelect.appendChild(opt);
        } else {
            tableNames.forEach(name => {
                const opt = document.createElement('option');
                opt.value = this.model.getTableIdByName(name);
                opt.textContent = name;
                typeSelect.appendChild(opt);
            });
        }
        typeSelect.addEventListener('change', this.handleTypeChange);
        toolbar.appendChild(typeSelect);

        // Add button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-success btn-sm';
        addBtn.textContent = '+ Add';
        addBtn.title = 'Add new instance as child of selected node';
        addBtn.addEventListener('click', this.handleAddNode);
        toolbar.appendChild(addBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-sm';
        deleteBtn.textContent = '🗑';
        deleteBtn.title = 'Delete selected node';
        deleteBtn.addEventListener('click', this.handleDeleteNode);
        toolbar.appendChild(deleteBtn);

        // Selection info
        const info = document.createElement('span');
        info.className = 'tree-selection-info';
        info.id = 'treeSelectionInfo';
        if (this.selectedInstanceId) {
            const table = this.model.getTable(this.selectedTableId);
            if (table) {
                const instance = table.instances.find(inst => inst.id === this.selectedInstanceId);
                if (instance) {
                    const displayName = this.model.getDisplayName(instance);
                    info.textContent = `Selected: ${displayName} [${table.name}]`;
                }
            }
        } else {
            info.textContent = 'No selection';
        }
        toolbar.appendChild(info);

        this.container.appendChild(toolbar);
    }

    createTreeNode(instance, depth = 0) {
        const div = document.createElement('div');
        div.className = 'tree-node';
        div.style.paddingLeft = `${depth * 20}px`;
        div.dataset.instanceId = instance.id;
        div.dataset.tableId = instance._tableId;

        const content = document.createElement('div');
        content.className = 'tree-node-content';

        const children = this.model.findChildren(instance.id, instance._tableId);
        const hasChildren = children.length > 0;

        if (hasChildren) {
            const toggle = document.createElement('span');
            toggle.className = 'tree-toggle';
            const isExpanded = this.expandedIds.has(instance.id);
            toggle.textContent = isExpanded ? '▼' : '▶';
            toggle.style.cursor = 'pointer';
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleExpand(instance.id);
            });
            content.appendChild(toggle);
        } else {
            const spacer = document.createElement('span');
            spacer.className = 'tree-toggle-spacer';
            spacer.textContent = ' ';
            content.appendChild(spacer);
        }

        // Display name with type badge
        const displayName = this.model.getDisplayName(instance);
        const typeLabel = instance._type || 'unknown';

        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = displayName;
        label.dataset.instanceId = instance.id;
        label.dataset.tableId = instance._tableId;

        const typeBadge = document.createElement('span');
        typeBadge.className = 'tree-type-badge';
        typeBadge.textContent = `[${typeLabel}]`;

        content.appendChild(label);
        content.appendChild(typeBadge);

        if (this.selectedInstanceId === instance.id) {
            content.classList.add('selected');
        }

        // Click to select
        content.addEventListener('click', (e) => {
            // Ignore if we're editing
            if (this.editingNode) return;
            this.selectInstance(instance.id, instance._tableId);
        });

        // Double-click to edit name
        content.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startEditing(instance, label);
        });

        div.appendChild(content);

        if (hasChildren && this.expandedIds.has(instance.id)) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            children.forEach(child => {
                const childNode = this.createTreeNode(child, depth + 1);
                childrenContainer.appendChild(childNode);
            });
            div.appendChild(childrenContainer);
        }

        return div;
    }

    // ----- Selection -----
    selectInstance(instanceId, tableId) {
        this.selectedInstanceId = instanceId;
        this.selectedTableId = tableId;

        if (this.onSelect) {
            this.onSelect(instanceId, tableId);
        }

        this.render();
    }

    toggleExpand(instanceId) {
        if (this.expandedIds.has(instanceId)) {
            this.expandedIds.delete(instanceId);
        } else {
            this.expandedIds.add(instanceId);
        }
        this.render();
    }

    // ----- Editing Name -----
    startEditing(instance, labelElement) {
        // Cancel any existing edit
        if (this.editingNode) {
            this.finishEditing(true);
        }

        const currentName = this.model.getDisplayName(instance);

        // Find the name property or title property
        const table = this.model.getTable(instance._tableId);
        if (!table) return;

        const propDef = table.getProperty('name') || table.getProperty('title');
        if (!propDef) {
            // No name or title property, can't edit
            alert('This instance has no "name" or "title" property to edit.');
            return;
        }

        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tree-name-editor';
        input.value = currentName;
        input.dataset.instanceId = instance.id;
        input.dataset.tableId = instance._tableId;
        input.dataset.propName = propDef.name;

        // Replace label with input
        labelElement.replaceWith(input);
        input.focus();
        input.select();

        this.editingNode = {
            instanceId: instance.id,
            tableId: instance._tableId,
            propName: propDef.name,
            inputElement: input,
            originalValue: currentName
        };

        // Event listeners
        input.addEventListener('blur', () => {
            this.finishEditing(false);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.finishEditing(false);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.finishEditing(true);
            }
        });
    }

    finishEditing(cancel = false) {
        if (!this.editingNode) return;

        const { instanceId, tableId, propName, inputElement, originalValue } = this.editingNode;

        let newValue = originalValue;
        if (!cancel) {
            const value = inputElement.value.trim();
            if (value && value !== originalValue) {
                const result = this.model.execute({
                    type: 'RENAME_INSTANCE',
                    tableId: tableId,
                    instanceId: instanceId,
                    newName: value,
                    property: propName
                });
                if (result.success) {
                    newValue = value;
                } else {
                    alert(`Failed to rename: ${result.error}`);
                }
            }
        }

        // Remove input and restore label
        const displayName = cancel ? originalValue : newValue;
        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = displayName;
        label.dataset.instanceId = instanceId;
        label.dataset.tableId = tableId;
        inputElement.replaceWith(label);

        this.editingNode = null;
    }

    // ----- Toolbar Actions -----
    handleTypeChange(e) {
        // Just update the selection info
        const typeSelect = document.getElementById('treeTypeSelect');
        const info = document.getElementById('treeSelectionInfo');
        if (typeSelect && info) {
            const selectedTableId = typeSelect.value;
            const table = this.model.getTable(selectedTableId);
            if (table) {
                info.textContent = `Ready to add: [${table.name}]`;
            }
        }
    }

    handleAddNode() {
        const typeSelect = document.getElementById('treeTypeSelect');
        const tableId = typeSelect ? typeSelect.value : null;

        if (!tableId) {
            alert('Please select a type from the dropdown.');
            return;
        }

        const result = this.model.execute({
            type: 'ADD_INSTANCE',
            tableId: tableId,
            data: {}
        });

        if (result.success) {
            this.selectInstance(result.instanceId, tableId);
            // Update selection info
            const info = document.getElementById('treeSelectionInfo');
            if (info) {
                const table = this.model.getTable(tableId);
                if (table) {
                    const instance = table.instances.find(inst => inst.id === result.instanceId);
                    if (instance) {
                        const displayName = this.model.getDisplayName(instance);
                        info.textContent = `Added: ${displayName} [${table.name}]`;
                    }
                }
            }
        } else {
            alert(`Failed to add: ${result.error}`);
        }
    }

    handleDeleteNode() {
        if (!this.selectedInstanceId || !this.selectedTableId) {
            alert('Please select a node to delete.');
            return;
        }

        const table = this.model.getTable(this.selectedTableId);
        if (!table) return;

        const instance = table.instances.find(inst => inst.id === this.selectedInstanceId);
        if (!instance) return;

        const displayName = this.model.getDisplayName(instance);

        // Check if this instance has children
        const children = this.model.findChildren(this.selectedInstanceId, this.selectedTableId);
        if (children.length > 0) {
            if (!confirm(`"${displayName}" has ${children.length} child(ren) that will become unlinked. Delete anyway?`)) {
                return;
            }
        }

        if (confirm(`Delete "${displayName}"?`)) {
            const result = this.model.execute({
                type: 'DELETE_INSTANCE',
                tableId: this.selectedTableId,
                instanceId: this.selectedInstanceId
            });

            if (result.success) {
                this.selectedInstanceId = null;
                this.selectedTableId = null;
                this.render();
            } else {
                alert(`Failed to delete: ${result.error}`);
            }
        }
    }

    // ----- Cleanup -----
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}
