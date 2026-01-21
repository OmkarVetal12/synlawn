import { LightningElement, api, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';

// Fields from Case
import TOTAL from '@salesforce/schema/Project__c.Turf_Sqft__c';
import COMPLETED from '@salesforce/schema/Project__c.turf_completed__c';

export default class ProjectProgress extends LightningElement {
    @api recordId;
    percentage = 0;

    @wire(getRecord, { recordId: '$recordId', fields: [TOTAL, COMPLETED] })
    wiredCase({ error, data }) {
        if (data) {
            const total = data.fields?.Turf_Sqft__c?.value ?? 0;
            const completed = data.fields?.turf_completed__c?.value ?? 0;

            if (total > 0 && completed > 0) {
                this.percentage = Math.min(100, Math.round((completed / total) * 100));
            } else {
                this.percentage = 0;
            }
        } else if (error) {
            console.error('Error fetching data:', error);
            this.percentage = 0;
        }
    }
}