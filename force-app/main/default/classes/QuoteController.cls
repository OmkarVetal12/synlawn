public without sharing class QuoteController {

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getQuoteData(String quoteNumber) {

        Map<String, Object> result = new Map<String, Object>();

        Quote q = [
            SELECT Id, GrandTotal, Terms_Conditions__c,Deposit_Value__c,
                (SELECT Id, Product2.Name, Product2.Product_Description_Link__c,
                        Quantity, UnitPrice, ListPrice, Product_Option__c,
                        Family__c,Sub_Family__c, Customer_Selection__c
                 FROM QuoteLineItems
                 WHERE Show_on_Proposal__c = true) 
            FROM Quote
            WHERE QuoteNumber = :quoteNumber
            LIMIT 1
        ];

        result.put('grandTotal', q.GrandTotal);
        result.put('terms', q.Terms_Conditions__c);
        result.put('items', q.QuoteLineItems);
        result.put('depositValue', q.Deposit_Value__c);

        return result;
    }
    
      @AuraEnabled
    public static void updateQuoteLineItems(List<QuoteLineItem> quoteLineItems) {
    
        if (quoteLineItems == null || quoteLineItems.isEmpty()) return;
    
        Set<String> families = new Set<String>();
        for (QuoteLineItem qli : quoteLineItems) {
            if (qli.Family__c != null) {
                families.add(qli.Family__c);
            }
        }
    
        List<QuoteLineItem> allFamilyItems = [
            SELECT Id, Family__c, ListPrice, UnitPrice, Customer_Selection__c,Quantity
            FROM QuoteLineItem
            WHERE Family__c IN :families
        ];
    
        Map<Id, QuoteLineItem> updateMap = new Map<Id, QuoteLineItem>(quoteLineItems);
    
        for (QuoteLineItem item : allFamilyItems) {
            QuoteLineItem selected = updateMap.get(item.Id);
    
            if (selected != null) {
                item.Customer_Selection__c = selected.Customer_Selection__c;
            }
        }
    
        update allFamilyItems;
    }


    @AuraEnabled
    public static void updateQuoteClientInfo(String acceptedBy, string quoteNumber, String clientIp, String latitude, String longitude) {
        if (quoteNumber == null) {
            throw new AuraHandledException('Quote ID is required.');
        }

        Quote q = [
            SELECT Id, Accepted_By__c, Client_Ip__c,
                   Client_Location__Latitude__s,
                   Client_Location__Longitude__s
            FROM Quote
            WHERE QuoteNumber = :quoteNumber LIMIT 1
        ];

        q.Client_Ip__c = clientIp;
        q.Accepted_By__c = acceptedBy;
        q.Accepted_Date__c = System.now(); 
        q.Status = 'Accepted';

        if (!String.isBlank(latitude) && !String.isBlank(longitude)) {
            try {
                q.Client_Location__Latitude__s  = Double.valueOf(latitude);
                q.Client_Location__Longitude__s = Double.valueOf(longitude);
            } catch (Exception e) {
                System.debug('Invalid lat/long');
            }
        }

        update q;
    }
}