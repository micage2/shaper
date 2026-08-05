import { Model } from './model/model.js';
import { TreeView } from './view/treeview/treeview.js';
import { PropertyView } from './view/treeview/propertyview.js';
import { TableView } from './view/tableview/tableview.js';
import { AppView } from './view/app-view.js';

export class App {
    constructor() {
        this.model = new Model();
        this.currentView = 'tree';
        this.views = {};

        // Initialize data
        this.initData();

        // Create views
        this.initViews();

        // Setup view switching
        this.setupViewSwitching();

        // Subscribe to model changes
        this.model.subscribe(() => {
            this.onDataChanged();
        });
    }

    initData() {
        // Products
        const productProps = [
            { name: 'id', type: 'number' },
            { name: 'name', type: 'string' },
            { name: 'price', type: 'number' },
            { name: 'inStock', type: 'boolean' },
            { name: 'tags', type: 'array' }
        ];
        const productRows = [
            { id: 101, name: 'Wireless Mouse', price: 29.99, inStock: true, tags: ['electronics', 'wireless'] },
            { id: 102, name: 'Gaming Keyboard', price: 79.50, inStock: false, tags: ['gaming', 'mechanical'] },
            { id: 103, name: 'USB-C Hub', price: 45.00, inStock: true, tags: ['adapter', 'usb'] },
            { id: 104, name: 'Monitor Stand', price: 34.99, inStock: true, tags: ['ergonomic', 'desk'] },
            { id: 105, name: 'Bluetooth Speaker', price: 59.99, inStock: false, tags: ['audio', 'portable'] }
        ];
        const productTableId = this.model.addTable('Products', productProps, productRows);

        // Suppliers
        const supplierProps = [
            { name: 'id', type: 'string' },
            { name: 'company', type: 'string' },
            { name: 'country', type: 'string' },
            { name: 'active', type: 'boolean' }
        ];
        const supplierRows = [
            { id: 'S1', company: 'TechSupply Co', country: 'USA', active: true },
            { id: 'S2', company: 'GlobalParts Ltd', country: 'UK', active: true },
            { id: 'S3', company: 'AsiaTrade Inc', country: 'China', active: false }
        ];
        const supplierTableId = this.model.addTable('Suppliers', supplierProps, supplierRows);

        // Add link column to Products
        const products = this.model.getTable(productTableId);
        if (products) {
            products.addColumn({
                name: 'supplierId',
                type: 'link',
                targetTable: supplierTableId
            });

            const suppliers = this.model.getTable(supplierTableId);
            if (suppliers) {
                const supplierIds = suppliers.instances.map(s => s.id);
                products.instances.forEach((row, idx) => {
                    row.supplierId = supplierIds[idx % supplierIds.length];
                });
                this.model.notify();
            }
        }
    }

    initViews() {
        // Get containers
        const treeContainer = document.getElementById('tree-view-container');
        const propertyContainer = document.getElementById('property-view-container');
        const tableContainer = document.getElementById('table-view-container');

        // Create views
        this.views.tree = new TreeView(treeContainer, this.model);
        this.views.property = new PropertyView(propertyContainer, this.model);
        this.views.table = new TableView(tableContainer, this.model);

        // Connect TreeView selection to PropertyView
        this.views.tree.onSelect = (instanceId, tableId) => {
            this.views.property.selectInstance(instanceId, tableId);
        };
    }

    setupViewSwitching() {
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const view = tab.dataset.view;
                const treeContainer = document.getElementById('tree-view-container');
                const propertyContainer = document.getElementById('property-view-container');
                const tableContainer = document.getElementById('table-view-container');

                if (view === 'tree') {
                    treeContainer.style.display = 'block';
                    propertyContainer.style.display = 'block';
                    tableContainer.style.display = 'none';
                } else {
                    treeContainer.style.display = 'none';
                    propertyContainer.style.display = 'none';
                    tableContainer.style.display = 'block';
                }
            });
        });
    }

    onDataChanged() {
        // Views re-render via their subscriptions
    }

    destroy() {
        this.views.tree.destroy();
        this.views.property.destroy();
        this.views.table.destroy();
    }
}

// Create and export app instance
export const app = new App();