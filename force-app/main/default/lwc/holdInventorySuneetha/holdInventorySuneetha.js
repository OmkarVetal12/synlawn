import { LightningElement, api, track } from 'lwc';

//import { getRecord } from 'lightning/uiRecordApi';

import getProductItemsByProductId from '@salesforce/apex/ProductController.getProductItemsByProductId';
import insertProductItemsByProductId from '@salesforce/apex/ProductController.insertProductItemsByProductId';
import getProductItemsCountByProductId from '@salesforce/apex/ProductController.getProductItemsCountByProductId';
import getProductItemId from '@salesforce/apex/ProductController.getProductItemId';
import getAvailableCountById from '@salesforce/apex/ProductController.getAvailableCountById';
import getProductItemsByQuoteLineItemIds from '@salesforce/apex/ProductController.getProductItemsByQuoteLineItemIds';

export default class HoldInventorySuneetha extends LightningElement {

    @track errors = [];
    @api recordId;
    @api selectedQuoteLineItems = [];
    productItems = [];
    productItemsList = [];
    countProductItems;
    @track availableCount;
    @track reservedCount;
    quoteId = "";
    @api ProductItemTransactionsCollection = [];
    @api draftValues;
    @track parsedDraftValues = []; // Preserve user edits across error rerenders
    @api ids = [];

    columns = [
        { label: 'Product Name', fieldName: 'productName' },
        { label: 'Location Name', fieldName: 'locationName' },
        { label: 'Product Family', fieldName: 'productFamily' },
        { label: 'Available', fieldName: 'quantityOnHand' },
        { label: 'Quality', fieldName: 'quality' },
        { label: 'Quantity to Reserve', fieldName: 'quantityToReserve', editable: true }
    ];

    @api
    validate() {
        // Custom validation logic

        if (this.errors && this.errors.rows && Object.keys(this.errors.rows).length > 0) {
            return {
                isValid: false,
                errorMessage: 'Please correct the errors before proceeding.'
            };
        }
        return {
            isValid: true,
            errorMessage: ''
        };
    }

    handleSearch(event) {
        const searchKey = event.target.value.toLowerCase();
        console.log('Search Key: ', searchKey);
        if (searchKey) {
            this.productItemsList = this.productItems.filter(item =>
                item.productName.toLowerCase().includes(searchKey) ||
                item.locationName.toLowerCase().includes(searchKey) ||
                item.productFamily.toLowerCase().includes(searchKey)
            );
            console.log('Filtered Items: ', this.productItemsList);
            //this.productItems = 
            //console.log('Filtered Items: ', this.productItems);

        } else {
            this.productItems = [...this.productItems];
            console.log('In else cond Items: ', this.productItems);
        }


    }

    connectedCallback() {
        //this.getCountProducts();
        console.log('Selected Quote Line Items on load: ', this.ids);
        this.loadProducts();
    }

    // async getCountProducts() {
    //     await getProductItemsCountByProductId({ productId: this.recordId })
    //         .then(result => {
    //             this.countProductItems = 'Products(' + result + ')';
    //             console.log('Count of products: ', this.countProductItems);
    //         })
    //         .catch(error => {
    //             this.error = error && error.body && error.body.message ? error.body.message : JSON.stringify(error);
    //             console.error('Error fetching product count: ', error);
    //         });
    // }

    async loadProducts() {
        console.log('Selected product items : ', ids);
        if (this.draftValues) {
            this.parsedDraftValues = JSON.parse(this.draftValues);
        } else {
            this.parsedDraftValues = [];
        }
        this.quoteId = this.selectedQuoteLineItems.length > 0 ? this.selectedQuoteLineItems[0].QuoteId : '';
        try {
            if (this.selectedQuoteLineItems && this.selectedQuoteLineItems.length) {
                const result = await getProductItemsByQuoteLineItemIds({ Product2Ids: this.selectedQuoteLineItems.map(item => item.Product2Id) });
                this.productItems = result || [];
                this.error = undefined;
                this.mergeDataWithDraftValues(this.productItems);
                return;
            }

        } catch (error) {
            this.error = error && error.body && error.body.message ? error.body.message : JSON.stringify(error);
            console.error('Error fetching products: ', error);
        }
    }

    mergeDataWithDraftValues(data) {
        let tempRow = {};
        if (this.parsedDraftValues && this.parsedDraftValues.length > 0) {
            data.forEach(item => {
                const draft = this.parsedDraftValues.find(d => d.Id === item.Id);
                console.log('Merging draft', draft);
                console.log('With item', item);
                if (draft) {
                    item.quantityToReserve = draft.quantityToReserve;
                    if (item.quantityOnHand < draft.quantityToReserve) {
                        tempRow[draft.Id] = {
                            messages: ['Reserved quantity exceeds available quantity.'],
                            fieldNames: ['quantityToReserve'],
                            title: 'Please reduce the quantity to reserve',
                        };
                        const existingErrors = this.errors.rows || {};
                        this.errors = { rows: { ...existingErrors, ...tempRow } };
                    }                    
                    
                }
            });
        }
    }

    async handleCellChange(event) {
        const updatedFields = event.detail.draftValues[0];
        console.log('Updated fields: ', updatedFields);

        this.updateDraftVaulesWithUserEnteredData(updatedFields);
        
        this.reservedCount = updatedFields.quantityToReserve;
        try {
            const result = await getAvailableCountById({ id: updatedFields.Id });
            this.availableCount = result.QuantityOnHand;
            console.log('Available Count: ', this.availableCount);

            if (this.availableCount > this.reservedCount) {
                const tx = {
                    ProductItemId: updatedFields.Id,
                    Quote__c: this.quoteId,
                    TransactionType: 'Adjusted',
                    Quantity: -(updatedFields.quantityToReserve),
                    On_Hold_Quantity__c: true
                };

                this.ProductItemTransactionsCollection = [...this.ProductItemTransactionsCollection, tx];

                if (this.errors.rows && this.errors.rows[updatedFields.Id]) {
                    const newErrors = { ...this.errors.rows };
                    delete newErrors[updatedFields.Id];
                    this.errors = { rows: newErrors }; // reassign — triggers reactivity
                    console.log('Error records after delete', JSON.stringify(this.errors));
                }
            } else {
                console.log('Error: Reserved quantity exceeds available quantity.');
                let tempRow = {};

                tempRow[updatedFields.Id] = {
                    messages: ['Reserved quantity exceeds available quantity.'],
                    fieldNames: ['quantityToReserve'],
                    title: 'Please reduce the quantity to reserve',
                };
                // Merge new error with existing errors instead of overwriting
                const existingErrors = this.errors.rows || {};
                this.errors = { rows: { ...existingErrors, ...tempRow } };
            }
        } catch (error) {
            this.error = error && error.body && error.body.message ? error.body.message : JSON.stringify(error);
            console.error('Error in handleCellChange: ', error);
        }
    }

    updateDraftVaulesWithUserEnteredData(updatedFields) {
        // Store draft value immediately to preserve it through rerenders
        if (this.draftValues) {
            this.parsedDraftValues = JSON.parse(this.draftValues);
        }
        const existingDraft = this.parsedDraftValues.find(d => d.Id === updatedFields.Id);
        if (existingDraft) {
            // Update existing draft
            existingDraft.quantityToReserve = updatedFields.quantityToReserve;
            this.parsedDraftValues = [...this.parsedDraftValues];  // Reassign to trigger @track reactivity
        } else {
            // Add new draft
            this.parsedDraftValues = [...this.parsedDraftValues, updatedFields];
        }
        this.draftValues = JSON.stringify(this.parsedDraftValues)
        console.log('Tracked draftValues: ', this.draftValues);
    }
}