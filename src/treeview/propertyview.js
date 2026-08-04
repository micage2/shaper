// src/TreeView/propertyview.js
export class PropertyView {
  constructor(container, model) {
    this.container = container;
    this.model = model;
    this.selectedInstanceId = null;
    this.selectedTableId = null;
    
    // Subscribe to model changes
    this.unsubscribe = model.subscribe(() => {
      if (this.selectedInstanceId) {
        this.render();
      }
    });
    
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    
    if (!this.selectedInstanceId || !this.selectedTableId) {
      this.container.innerHTML = '<div class="property-empty">Select an instance to view properties</div>';
      return;
    }
    
    const table = this.model.getTable(this.selectedTableId);
    if (!table) {
      this.container.innerHTML = '<div class="property-empty">Table not found</div>';
      return;
    }
    
    const instance = table.instances.find(inst => inst.id === this.selectedInstanceId);
    if (!instance) {
      this.container.innerHTML = '<div class="property-empty">Instance not found</div>';
      return;
    }
    
    const container = document.createElement('div');
    container.className = 'property-container';
    
    // Header
    const header = document.createElement('div');
    header.className = 'property-header';
    const displayName = this.model.getDisplayName(instance);
    header.innerHTML = `
      <span class="property-title">${displayName}</span>
      <span class="property-type">[${table.name}]</span>
    `;
    container.appendChild(header);
    
    // Property list
    const list = document.createElement('div');
    list.className = 'property-list';
    
    // Show all properties
    const propDefs = table.properties;
    for (const propDef of propDefs) {
      const value = instance[propDef.name];
      const item = document.createElement('div');
      item.className = 'property-item';
      
      const label = document.createElement('span');
      label.className = 'property-label';
      label.textContent = propDef.name;
      
      const valueSpan = document.createElement('span');
      valueSpan.className = 'property-value';
      
      // Handle different types
      if (propDef.type === 'link' && value) {
        // Link to another instance - make it clickable
        const link = document.createElement('a');
        link.className = 'property-link';
        link.textContent = this.model.getDisplayName({ id: value }) || value;
        link.href = '#';
        link.addEventListener('click', (e) => {
          e.preventDefault();
          // Find the linked instance
          const targetTable = this.model.getTable(propDef.targetTable);
          if (targetTable) {
            const targetInstance = targetTable.instances.find(inst => inst.id === value);
            if (targetInstance) {
              // Navigate to this instance
              this.selectInstance(value, propDef.targetTable);
            }
          }
        });
        valueSpan.appendChild(link);
      } else if (propDef.type === 'boolean') {
        valueSpan.textContent = value ? '✓ true' : '✗ false';
      } else if (propDef.type === 'array') {
        valueSpan.textContent = Array.isArray(value) ? JSON.stringify(value) : String(value);
      } else {
        valueSpan.textContent = value !== undefined && value !== null ? String(value) : '—';
      }
      
      item.appendChild(label);
      item.appendChild(valueSpan);
      list.appendChild(item);
    }
    
    container.appendChild(list);
    this.container.appendChild(container);
  }

  selectInstance(instanceId, tableId) {
    this.selectedInstanceId = instanceId;
    this.selectedTableId = tableId;
    this.render();
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}