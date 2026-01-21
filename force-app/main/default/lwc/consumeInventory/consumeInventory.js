import { LightningElement, api, track, wire } from 'lwc';
import getHeldInventory from '@salesforce/apex/WorkOrderInventoryController.getHeldInventory';
import consumeInventory from '@salesforce/apex/WorkOrderInventoryController.consumeInventory';
import QUOTE_FIELD from '@salesforce/schema/WorkOrder.Quote__c';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';

export default class ConsumeInventory extends LightningElement {
    @api recordId;
    @track inventoryItems = [];
    quoteId;
    @wire(getHeldInventory, { workOrderId: '$recordId' })
    loadInventory({ data, error }) {
        if (data) {
            this.inventoryItems = data.map(item => ({
                ...item,
                quantityToConsume: 0
            }));
            this.quoteId = data[0]?.quoteId;
        }

        if (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Failed to load inventory',
                    variant: 'error'
                })
            );
        }
    }

    handleQuantityChange(event) {
        const productItemId = event.target.dataset.id;
        const enteredQuantity = Number(event.target.value);

        this.inventoryItems = this.inventoryItems.map(item => {
            if (item.productItemId === productItemId) {
                return {
                    ...item,
                    quantityToConsume: isNaN(enteredQuantity)
                        ? 0
                        : Math.min(enteredQuantity, item.quantityOnHold)
                };
            }
            return item;
        });
    }

    async handleConfirm() {
        const productItemIds = [];
        const quantities = [];
        const locationIds = [];

        this.inventoryItems.forEach(item => {
            if (item.quantityToConsume > 0) {
                productItemIds.push(item.productItemId);
                quantities.push(item.quantityToConsume);
                locationIds.push(item.locationId);
            }
        });

        if (!productItemIds.length) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Enter quantity to consume',
                    variant: 'error'
                })
            );
            return;
        }

        try {
            await consumeInventory({
                workOrderId: this.recordId,
                quoteId:this.quoteId,
                productItemIds,
                quantities,
                locationIds
            });

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Inventory consumed successfully',
                    variant: 'success'
                })
            );

            this.dispatchEvent(new CloseActionScreenEvent());

        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error?.body?.message || 'Inventory consumption failed',
                    variant: 'error'
                })
            );
        }
    }
}
