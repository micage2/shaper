// src/app.js
import { Model } from './model/model.js';
import { TreeView } from './view/treeview/treeview.js';
import { PropertyView } from './view/treeview/propertyview.js';
import { TableView } from './view/tableview/tableview.js';

export class App {
    constructor() {
        this.model = new Model();
        this.currentView = 'tree';
        this.views = {};
        
        // Initialize with demo data
        this.initData();
        
        // Setup views and handlers
        this.initViews();
        this.setupViewSwitching();
        this.setupImportExport();
        
        // Subscribe to model changes
        this.model.subscribe(() => {
            this.onDataChanged();
        });
    }

    initData() {
        // ---- RPG Example Data ----
        
        // 1. City
        const cityUuid = this.model.addTable('City', [
            { name: 'name', type: 'string' },
            { name: 'population', type: 'number' }
        ]);
        const city = this.model.getTable(cityUuid);
        city.insertRow({ name: 'Dragonhold', population: 12000 });
        city.insertRow({ name: "Baldur's Gate", population: 42000 });
        city.insertRow({ name: 'Neverwinter', population: 23000 });
        
        // 2. Building
        const buildingUuid = this.model.addTable('Building', [
            { name: 'name', type: 'string' },
            { name: 'city', type: 'link', targetTable: cityUuid },
            { name: 'type', type: 'string' }
        ]);
        const building = this.model.getTable(buildingUuid);
        
        // Dragonhold (row index 0)
        building.insertRow({ name: "Talon's Residence", city: 0, type: 'house' });
        building.insertRow({ name: 'The Rusty Dagger Inn', city: 0, type: 'inn' });
        building.insertRow({ name: 'Temple of the Old Gods', city: 0, type: 'temple' });
        
        // Baldur's Gate (row index 1)
        building.insertRow({ name: 'Sorcerous Sundries', city: 1, type: 'shop' });
        building.insertRow({ name: 'The Elfsong Tavern', city: 1, type: 'tavern' });
        
        // Neverwinter (row index 2)
        building.insertRow({ name: 'The Moonstone Mask', city: 2, type: 'inn' });
        
        // 3. Character
        const charUuid = this.model.addTable('Character', [
            { name: 'name', type: 'string' },
            { name: 'building', type: 'link', targetTable: buildingUuid },
            { name: 'level', type: 'number' }
        ]);
        const character = this.model.getTable(charUuid);
        
        character.insertRow({ name: 'Talon', building: 0, level: 5 });
        character.insertRow({ name: 'Greta', building: 1, level: 4 });
        character.insertRow({ name: 'Ulric', building: 2, level: 6 });
        character.insertRow({ name: 'Eldric', building: 3, level: 3 });
        character.insertRow({ name: 'Silas', building: 4, level: 2 });
        character.insertRow({ name: 'Myra', building: 5, level: 4 });
        
        // 4. Weapon
        const weaponUuid = this.model.addTable('Weapon', [
            { name: 'name', type: 'string' },
            { name: 'damage', type: 'number' },
            { name: 'owner', type: 'link', targetTable: charUuid }
        ]);
        const weapon = this.model.getTable(weaponUuid);
        
        weapon.insertRow({ name: "Talon's Bow", damage: 12, owner: 0 });
        weapon.insertRow({ name: "Greta's Axe", damage: 18, owner: 1 });
        weapon.insertRow({ name: "Ulric's Staff", damage: 8, owner: 2 });
        weapon.insertRow({ name: "Eldric's Dagger", damage: 6, owner: 3 });
        weapon.insertRow({ name: "Silas's Shortsword", damage: 10, owner: 4 });
        weapon.insertRow({ name: "Myra's Spear", damage: 14, owner: 5 });
        weapon.insertRow({ name: 'Dagger', damage: 4, owner: null });
        
        // 5. Armor
        const armorUuid = this.model.addTable('Armor', [
            { name: 'name', type: 'string' },
            { name: 'protection', type: 'number' },
            { name: 'owner', type: 'link', targetTable: charUuid }
        ]);
        const armor = this.model.getTable(armorUuid);
        
        armor.insertRow({ name: "Hunter's Robe", protection: 5, owner: 0 });
        armor.insertRow({ name: 'Chainmail', protection: 8, owner: 1 });
        armor.insertRow({ name: 'Cloak of Shadows', protection: 6, owner: 2 });
        armor.insertRow({ name: 'Mage Robe', protection: 4, owner: 3 });
        armor.insertRow({ name: 'Leather Armor', protection: 7, owner: 4 });
        armor.insertRow({ name: 'Plate Mail', protection: 10, owner: 5 });
        
        // Set City as current table
        this.model.currentTableId = cityUuid;
        this.model.notify();
    }

    initViews() {
        const treeContainer = document.getElementById('tree-view-container');
        const propertyContainer = document.getElementById('property-view-container');
        const tableContainer = document.getElementById('table-view-container');

        this.views.tree = new TreeView(treeContainer, this.model);
        this.views.property = new PropertyView(propertyContainer, this.model);
        this.views.table = new TableView(tableContainer, this.model);

        // Connect TreeView selection to PropertyView
        this.views.tree.onSelect = (rowIdx, tableUuid) => {
            this.views.property.selectInstance(rowIdx, tableUuid);
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
        
        // Set initial view state
        const treeContainer = document.getElementById('tree-view-container');
        const propertyContainer = document.getElementById('property-view-container');
        const tableContainer = document.getElementById('table-view-container');
        if (treeContainer) treeContainer.style.display = 'block';
        if (propertyContainer) propertyContainer.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
    }

    setupImportExport() {
        // Import button
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.json';
                
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const result = this.model.fromJSON(event.target.result);
                            if (result.success) {
                                console.log(`✅ Import: ${result.tableCount} tables, ${result.rowCount} rows`);
                            } else {
                                console.error(`❌ Import failed: ${result.error}`);
                            }
                        } catch (err) {
                            console.error(`❌ Invalid JSON: ${err.message}`);
                        }
                    };
                    reader.onerror = () => console.error('❌ Failed to read file');
                    reader.readAsText(file);
                    fileInput.value = '';
                });
                
                fileInput.click();
            });
        }
        
        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const jsonData = this.model.toJSON();
                const jsonString = JSON.stringify(jsonData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'shaper-data.json';
                a.click();
                URL.revokeObjectURL(url);
            });
        }
    }

    onDataChanged() {
        // Views re-render via their subscriptions
        // No action needed here
    }
}

// Create app instance
const app = new App();