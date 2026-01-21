import { LightningElement, api, track, wire } from 'lwc';
import getQuoteLineItems from '@salesforce/apex/HoldInventoryController.getQuoteLineItems';
import checkInventory from '@salesforce/apex/HoldInventoryController.checkInventory';
import createProductItemTransactions from '@salesforce/apex/HoldInventoryController.createProductItemTransactions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';
import { refreshApex } from '@salesforce/apex';


export default class HoldInventory extends LightningElement {
    @api recordId;

    currentScreen = 'SELECT';

    @track productList = [];
    selectedQuoteLineItemIds = [];

    @track inventoryData = [];
    @track visibleInventoryData = [];

    productSearchText = '';
    locationSearchText = '';
    wiredQuoteLineItemsResult;
    
    @wire(getQuoteLineItems, { quoteId: '$recordId' })
loadQuoteLineItems(result) {
    this.wiredQuoteLineItemsResult = result;

    if (result.data) {
        this.productList = result.data.map(item => ({
            id: item.id,
            name: item.productName,
            family: item.family,
            quantity: item.quantity,
            onHold: item.onHold,
            isSelected: false
        }));
    } else if (result.error) {
        console.error(result.error);
    }
}
    get isSelectScreen() {
        return this.currentScreen === 'SELECT';
    }

    get isInventoryScreen() {
        return this.currentScreen === 'VALIDATE';
    }

    handleProductSelection(event) {
        const selectedId = event.target.dataset.id;

        this.productList = this.productList.map(product =>
            product.id === selectedId
                ? { ...product, isSelected: event.target.checked }
                : product
        );

        this.selectedQuoteLineItemIds = this.productList
            .filter(product => product.isSelected)
            .map(product => product.id);
    }

    get isNextDisabled() {
        return this.selectedQuoteLineItemIds.length === 0;
    }

   async handleNext() {
    if (!this.selectedQuoteLineItemIds.length) {
        return;
    }

    this.currentScreen = 'VALIDATE';

    try {
        const inventoryResponse = await checkInventory({
            quoteLineItemIds: this.selectedQuoteLineItemIds
        });

        this.inventoryData = inventoryResponse.map(row => ({
            ...row,
            holdQuantity: 0,                     // user input
            quantityOnHold: row.quantityOnHold || 0 // from Apex
        }));

        this.visibleInventoryData = [...this.inventoryData];

    } catch (error) {
        console.error('checkInventory failed', error);
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message: 'Failed to load inventory',
                variant: 'error'
            })
        );
    }
}

    handleBack() {
        this.currentScreen = 'SELECT';
    }

    handleProductFilterChange(event) {
        this.productSearchText = event.target.value.toLowerCase();
        this.applyFilters();
    }

    handleLocationFilterChange(event) {
        this.locationSearchText = event.target.value.toLowerCase();
        this.applyFilters();
    }

    applyFilters() {
        this.visibleInventoryData = this.inventoryData.filter(row =>
            row.productName.toLowerCase().includes(this.productSearchText) &&
            row.locationName.toLowerCase().includes(this.locationSearchText)
        );
    }

   handleHoldQuantityChange(event) {
    const productItemId = event.target.dataset.id;
    const enteredValue = parseFloat(event.target.value);

    this.visibleInventoryData = this.visibleInventoryData.map(row => {
        if (row.productItemId === productItemId) {
            return {
                ...row,
                holdQuantity: isNaN(enteredValue)
                    ? 0
                    : Math.min(enteredValue, row.availableQty)
            };
        }
        return row;
    });
}


   async handleConfirm() {
    const productItemIds = [];
    const holdQuantities = [];
    const productIds = [];
    const locationIds = [];

    console.log('visibleInventoryData', JSON.stringify(this.visibleInventoryData));

    this.visibleInventoryData.forEach(row => {
        const qty = Number(row.holdQuantity);

        if (!isNaN(qty) && qty > 0 && row.productItemId) {
            productItemIds.push(row.productItemId);
            holdQuantities.push(qty);
            productIds.push(row.productId);
            locationIds.push(row.locationId); 
        }
    });

    if (!productItemIds.length) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message: 'Please enter at least one valid hold quantity.',
                variant: 'error'
            })
        );
        return;
    }

    await createProductItemTransactions({
        productItemIds,
        quantities: holdQuantities,
        productIds,
        locationIds,
        quoteId: this.recordId
    });

    this.dispatchEvent(
        new ShowToastEvent({
            title: 'Success',
            message: 'Inventory has been placed on hold successfully.',
            variant: 'success'
        })
    );

    this.dispatchEvent(new CloseActionScreenEvent());
}



       renderedCallback() {
        if (!this.hasRefreshed && this.wiredQuoteLineItemsResult && this.recordId) {
            this.hasRefreshed = true;
            refreshApex(this.wiredQuoteLineItemsResult);
            console.log('renderedCallback', this.hasRefreshed);
        }
        console.log('renderedCallback', this.recordId);
    }


}