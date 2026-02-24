import { LightningElement, wire, api, track } from 'lwc';
import getQuoteData from '@salesforce/apex/QuoteController.getQuoteData';
import updateQuoteClientInfo from '@salesforce/apex/QuoteController.updateQuoteClientInfo';
import { refreshApex } from '@salesforce/apex';
import SYNLogo from '@salesforce/resourceUrl/SYNLogo';
import { subscribe, unsubscribe } from 'lightning/empApi';
import quoteProposalHelp from '@salesforce/resourceUrl/quoteProposalHelp';

export default class QuoteOptionSelector extends LightningElement {
    @api recordId;
    @track message;
    @track messageVariant; 
    @track quoteLineItems = [];
    @track groupedItems = {};
    @track groupedFamilies = [];
    @track submitterName = '';
    @track termsAccepted = false;
    @track clientInfo = null;
    quoteHelpImageUrl = quoteProposalHelp;
    showHelp = true;
    channelName = '/event/Quote_Payment_Ready__e';
    subscription = null;
    quoteNumber;
    paymentLink;
    disableRadioButtons = false;
    disableAcceptActions = true;
    disablePayNowActions = true;

    selectedMap = new Map();
    synLogoUrl = SYNLogo;
    isLoading = true;
    wiredResult;
    grandTotal;
    netTotal;
    SalesTaxTotal;
    depositValue;
    terms;
    quoteAccepted = false;
    // GET  DATA 
toggleHelp() {
    this.showHelp = !this.showHelp;
}

closeHelp() {
    this.showHelp = false;
}
    @wire(getQuoteData, { quoteNumber: '$quoteNumber'})
    wiredQuoteData(result) {
        this.wiredResult = result;
        const { data, error } = result;

        if (data) {
            debugger
            this.isLoading = false;
            this.grandTotal = data.totalPrice;
            this.depositValue = data.depositValue;
            this.terms = data.terms;

            this.quoteLineItems = (data.items || []).map(item => ({
                ...item,
                isIncluded: item.Product_Option__c === 'Included',
                isSelectable: ['Optional', 'Recommended'].includes(item.Product_Option__c),
                isChecked: item.Product_Option__c === 'Recommended'

            }));

            this.buildGroupingAndSelection();
            this.recalculateTotals();
        } else if (error) {
            this.isLoading = false;
            console.error('Error fetching quote data', error);
            this.quoteLineItems = [];
            this.groupedItems = {};
            this.groupedFamilies = [];
            this.selectedMap.clear();
        }
    }


    showToast(title, message, variant = 'info') {
        this.message = message;
        this.messageVariant = variant;

        clearTimeout(this._msgTimer);
        this._msgTimer = setTimeout(() => {
            this.clearMessage();
        }, 6000);
    }

    clearMessage() {
        this.message = null;
        this.messageVariant = null;
    }


buildGroupingAndSelection() {
    this.groupedItems = {};
    this.selectedMap.clear();
    // display family and subfamily
    this.quoteLineItems.forEach(parent => {
        const family = parent.Family__c || 'Other';
        const subFamily = parent.Sub_Family__c || '__NO_SUB__';

        if (!this.groupedItems[family]) {
            this.groupedItems[family] = {};
        }

        if (!this.groupedItems[family][subFamily]) {
            this.groupedItems[family][subFamily] = {
                subFamily: subFamily === '__NO_SUB__' ? null : subFamily,
                items: []
            };
        }

        this.groupedItems[family][subFamily].items.push({
            ...parent,
            subItems: (parent.Sub_Items || []).map(child => ({
                ...child,
                isChild: true
            }))
        });
    });
    Object.keys(this.groupedItems).forEach(family => {
        Object.keys(this.groupedItems[family]).forEach(groupKey => {
            const items = this.groupedItems[family][groupKey].items;

            const selected =
                items.find(i => i.Product_Option__c === 'Recommended') ||
                items[0];

            if (selected) {
                this.selectedMap.set(`${family}::${groupKey}`, selected.Id);
            }
        });
    });

    //uiStructure
    this.groupedFamilies = Object.keys(this.groupedItems)
        .sort()
        .map(family => ({
            family,
            subGroups: Object.keys(this.groupedItems[family]).map(groupKey => {
                const group = this.groupedItems[family][groupKey];

                return {
                    subFamily: group.subFamily,
                    groupKey,
                    radioName: `${family}-${groupKey}`,
                    items: group.items.map(parent => ({
                        ...parent,
                        isChecked:
                            this.selectedMap.get(`${family}::${groupKey}`) === parent.Id,
                        netTotal : parent.Net_Total,
                        netTaxTotal: parent.Net_Tax_Total,
                        subItems: parent.subItems || []
                    }))
                };
            })
        }));
}



  handleOptionChange(event) {
    const family = event.target.dataset.family;
    const groupKey = event.target.dataset.group;
    const selectedId = event.target.value;

    if (!family || !groupKey) return;

    this.selectedMap.set(`${family}::${groupKey}`, selectedId);

    this.groupedItems[family][groupKey].items.forEach(
        item => item.isChecked = item.Id === selectedId
    );

        this.groupedFamilies = Object.keys(this.groupedItems)
                .sort()
                .map(f => ({
                    family: f,
                    subGroups: Object.keys(this.groupedItems[f]).map(gk => {
                        const group = this.groupedItems[f][gk];

                        return {
                            subFamily: group.subFamily,
                            groupKey: gk,
                            radioName: `${f}-${gk}`,
                            items: group.items.map(parent => ({
                                ...parent,
                                isChecked:
                                    this.selectedMap.get(`${f}::${gk}`) === parent.Id,                                    
                                netTotal : parent.Net_Total,
                                netTaxTotal: parent.Net_Tax_Total,   
                                subItems: parent.subItems || [] 
                            }))
                        };
                    })
                }));
            this.recalculateTotals();
    }





    /*handleSave() {
    const selectedIds = [];

this.selectedMap.forEach(id => {
    if (id) {
        console.log('Pushing selected QLI Id:', id);
        selectedIds.push(id);
    }
});

console.log(' selectedIds array:', selectedIds);

    this.showToast(
        'Saved',
        'Your selections are saved temporarily and will be finalized on Accept.',
        'success'
    );
}
*/
getSelectedIds() {
    const selectedIds = [];

    this.selectedMap.forEach(id => {
        if (id) {
            selectedIds.push(id);
        }
    });

    console.log('Selected QLI IDs sent to Apex:', selectedIds);
    return selectedIds;
}
    async handleAccept() {
    if (!this.termsAccepted) {
        this.showToast('Terms Required', 'Please accept the Terms & Conditions.', 'warning');
        return;
    }

    if (!this.submitterName.trim()) {
        this.showToast('Name Required', 'Please enter your name.', 'warning');
        return;
    }

    this.isLoading = true;

    try {
        const info = this.clientInfo
            ? this.clientInfo
            : await this.getIpAndLocation();

        this.clientInfo = info;

        await updateQuoteClientInfo({
            acceptedBy: this.submitterName,
            quoteNumber: this.quoteNumber,
            selectedQuoteLineItemIds: this.getSelectedIds(),
            clientIp: info?.ip || 'unknown',
            latitude: info?.coords?.latitude?.toString() || null,
            longitude: info?.coords?.longitude?.toString() || null
        });

        await refreshApex(this.wiredResult);

        this.disableRadioButtons = true;
        this.disableAcceptActions = true;
        this.quoteAccepted = true;
        this.showToast(
            'Quote Accepted',
            `Thank you, ${this.submitterName}. Your acceptance has been recorded.`,
            'success'
        );

    } catch (err) {
        console.error(err);
        this.showToast('Error', 'Failed to accept quote.', 'error');
    } finally {
        this.isLoading = false;
    }
}


    // INPUTS

    handleNameChange(event) {
        this.submitterName = event.target.value;
        if(!this.quoteAccepted){
            this.disableAcceptActions = !(this.submitterName && this.termsAccepted);
        }
       
    }
        recalculateTotals() {
            let total = 0;
            let netTotal = 0;
            let SalesTaxTotal = 0;
            this.groupedFamilies.forEach(family => {
                family.subGroups.forEach(group => {
                    group.items.forEach(parent => {
                        if (parent.isChecked) {
                            total += parent.Net_Tax_Total || 0;
                            netTotal += parent.Net_Total || 0;
                        }
                    });
                });
            });

            this.grandTotal = total;
            this.netTotal =netTotal;
            this.SalesTaxTotal = total - netTotal;
            this.depositValue = total * 0.5;

            console.log('Preview Grand Total:', this.grandTotal);
        }

    async handleTermsChange(event) {
        this.termsAccepted = event.target.checked;
        if (this.termsAccepted) this.clientInfo = await this.getIpAndLocation();
        if(!this.quoteAccepted){
            this.disableAcceptActions = !(this.submitterName && this.termsAccepted);
        }
    }

    handlePayNow() {
        if (!this.termsAccepted || !this.submitterName.trim()) {
            this.showToast('Action Required', 'Complete acceptance first.', 'warning');
            return;
        }
        window.open('https://www.synlawn.com/', '_blank');
    }

    // CLIENT INFO 

    async getIpAndLocation() {
        const info = { ip: null, coords: null };
        try {
            const resp = await fetch('/services/apexrest/ClientInfo/');
            if (resp.ok) info.ip = (await resp.json())?.ip || 'unknown';

            if (navigator.geolocation) {
                await new Promise(resolve => {
                    navigator.geolocation.getCurrentPosition(
                        pos => { info.coords = pos.coords; resolve(); },
                        () => resolve()
                    );
                });
            }
        } catch {}
        return info;
    }


    connectedCallback() {
        const params = new URLSearchParams(window.location.search);
        this.quoteNumber = params.get('quoteNumber');
        this.subscribeToPaymentEvent();
    }


    subscribeToPaymentEvent() {
        debugger
        subscribe(this.channelName, -1, message => {
            const payload = message.data.payload;

            if (payload.QuoteNumber__c === this.quoteNumber) {
                this.paymentLink = payload.PaymentLink__c;
                this.disablePayNowActions = false;

                this.showToast(
                    'Payment Ready',
                    'Your payment link is now available.',
                    'success'
                );
            }
        }).then(response => {
            this.subscription = response;
        });
    }

    disconnectedCallback() {
        if (this.subscription) {
            unsubscribe(this.subscription);
        }
    }


    get toastStyle() {
    let bg = '#706e6b'; 

    switch (this.messageVariant) {
        case 'success':
            bg = '#2e844a';
            break;
        case 'error':
            bg = '#ba0517';
            break;
        case 'warning':
            bg = '#fe9339';
            break;
        case 'info':
        default:
            bg = '#0176d3';
    }

    return `
        background-color: ${bg};
        color: white;
        min-width: 320px;
        max-width: 420px;
        padding: 1rem;
        border-radius: 0.25rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
}

}