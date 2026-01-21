import { LightningElement, api, track } from 'lwc';

export default class FlowProductItemConsumption extends LightningElement {
    @api productItemsJson;      // JSON string of ProductItem records
    @api displayFields;         // Comma-separated ProductItem field API names
    @api workOrderId;           // Work Order Id
    @api productConsumedListJson; // Output JSON for ProductConsumed list

    @track productItems = [];
    @track columns = [];
    @track draftValues = [];

    connectedCallback() {
        try {
            this.productItems = this.productItemsJson ? JSON.parse(this.productItemsJson) : [];
            this.generateColumns();
        } catch (error) {
            console.error('Error parsing productItemsJson', error);
        }
    }

    generateColumns() {
        if (!this.displayFields) return;

        const fields = this.displayFields.split(',').map(f => f.trim());
        const baseColumns = fields.map(field => ({
            label: field.replace('__c', '').replace(/_/g, ' '),
            fieldName: field,
            editable: false
        }));

        const extraColumns = [
            {
                label: 'Quantity Consumed',
                fieldName: 'QuantityConsumed',
                type: 'number',
                editable: true
            },
            {
                label: 'Status',
                fieldName: 'Status',
                type: 'picklist',
                editable: true,
                typeAttributes: {
                    placeholder: 'Select...',
                    options: [
                        { label: 'On Hold', value: 'On Hold' },
                        { label: 'Utilized', value: 'Utilized' }
                    ]
                }
            }
        ];

        this.columns = [...baseColumns, ...extraColumns];
    }

    handleSave(event) {
        const updates = event.detail.draftValues;
        this.productItems = this.productItems.map(item => {
            const update = updates.find(u => u.Id === item.Id);
            return update ? { ...item, ...update } : item;
        });
        this.draftValues = [];
    }

    handleConfirm() {
        const validItems = this.productItems.filter(
            item => item.QuantityConsumed && item.Status
        );

        if (validItems.length === 0) {
            alert('Please enter Quantity and Status for at least one record.');
            return;
        }

        const consumedList = validItems.map(item => ({
            WorkOrderId: this.workOrderId,
            ProductItemId: item.Id,
            QuantityConsumed__c: Number(item.QuantityConsumed),
            Description__c: item.Status
        }));

        this.productConsumedListJson = JSON.stringify(consumedList);

        const flowEvent = new CustomEvent('valuechange', {
            detail: {
                name: 'productConsumedListJson',
                newValue: this.productConsumedListJson
            }
        });
        this.dispatchEvent(flowEvent);
    }
}