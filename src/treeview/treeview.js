// src/TreeView/treeview.js
export class TreeView {
    constructor(container, model) {
        this.container = container;
        this.model = model;
        this.selectedInstanceId = null;
        this.selectedTableId = null;
        this.expandedIds = new Set();
        this.onSelect = null; // Callback for selection changes

        // Subscribe to model changes
        this.unsubscribe = model.subscribe(() => {
            this.render();
        });

        this.render();
    }

    render() {
        const roots = this.model.getRootInstances();
        this.container.innerHTML = '';

        if (roots.length === 0) {
            this.container.innerHTML = '<div class="tree-empty">No data. Create some instances!</div>';
            return;
        }

        const treeContainer = document.createElement('div');
        treeContainer.className = 'tree-container';

        // Build tree from roots
        roots.forEach(root => {
            const item = this.createTreeNode(root);
            treeContainer.appendChild(item);
        });

        this.container.appendChild(treeContainer);
    }

    createTreeNode(instance, depth = 0) {
        const div = document.createElement('div');
        div.className = 'tree-node';
        div.style.paddingLeft = `${depth * 20}px`;
        div.dataset.instanceId = instance.id;
        div.dataset.tableId = instance._tableId;

        // Node content (clickable area)
        const content = document.createElement('div');
        content.className = 'tree-node-content';

        // Check if this instance has children
        const children = this.model.findChildren(instance.id, instance._tableId);
        const hasChildren = children.length > 0;

        // Expand/collapse toggle
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

        const typeBadge = document.createElement('span');
        typeBadge.className = 'tree-type-badge';
        typeBadge.textContent = `[${typeLabel}]`;
        typeBadge.style.color = this.getTypeColor(typeLabel);

        content.appendChild(label);
        content.appendChild(typeBadge);

        // Selection
        if (this.selectedInstanceId === instance.id) {
            content.classList.add('selected');
        }

        content.addEventListener('click', () => {
            this.selectInstance(instance.id, instance._tableId);
        });

        div.appendChild(content);

        // Children (if expanded)
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

    toggleExpand(instanceId) {
        if (this.expandedIds.has(instanceId)) {
            this.expandedIds.delete(instanceId);
        } else {
            this.expandedIds.add(instanceId);
        }
        this.render();
    }

    selectInstance(instanceId, tableId) {
        this.selectedInstanceId = instanceId;
        this.selectedTableId = tableId;

        // Trigger callback if set
        if (this.onSelect) {
            this.onSelect(instanceId, tableId);
        }

        this.render();
    }

    getTypeColor(type) {
        const colors = {
            'Product': '#4CAF50',
            'Supplier': '#2196F3',
            'Category': '#FF9800',
            'Country': '#9C27B0',
            'Order': '#E91E63',
            'Customer': '#00BCD4'
        };
        return colors[type] || '#666';
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}