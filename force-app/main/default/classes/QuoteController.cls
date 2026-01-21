public without sharing class QuoteController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getQuoteData(String quoteNumber) {
        
        Map<String, Object> result = new Map<String, Object>();
        Decimal depositValue = 0;
        Quote q = [
            SELECT Id, GrandTotal, Terms_Conditions__c,Deposit_Value__c,Total_Price_With_Tax__c,
            (SELECT Id, Product2.Name, Product2.Product_Description_Link__c,
             Quantity, UnitPrice, ListPrice, Product_Option__c,
             Family__c,Sub_Family__c, Customer_Selection__c,
             Total_Price_With_Tax__c            
             FROM QuoteLineItems
             WHERE Show_on_Proposal__c = true) 
            FROM Quote
            WHERE QuoteNumber = :quoteNumber
            LIMIT 1
        ];
  
        
        if (q.Total_Price_With_Tax__c != null) {
            depositValue = q.Total_Price_With_Tax__c * 0.5;
        }
        result.put('grandTotal', q.GrandTotal);
        result.put('totalPrice', q.Total_Price_With_Tax__c);
        result.put('terms', q.Terms_Conditions__c);
        result.put('items', q.QuoteLineItems);
        result.put('depositValue',depositValue);
        
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
        //confirm as this can we dont from flow as well
        List<QuoteLineItem> qlisToRemove = [
            SELECT Id, Quantity, UnitPrice, TotalPrice,
            Product2Id,Product2.Name, QuoteId, Customer_Selection__c
            FROM QuoteLineItem
            WHERE QuoteId = :q.Id
            AND (Customer_Selection__c = false OR Customer_Selection__c = null) AND Product_Option__c !='Included'
        ];
        
        if (qlisToRemove.isEmpty()) {
            return;
        }
     //   QuickBooksAPIHandler.readInvoice();
        List<Removed_Quote_line_Item__c> removedItems = new List<Removed_Quote_line_Item__c>();
        
        for (QuoteLineItem qli : qlisToRemove) {
            removedItems.add(new Removed_Quote_line_Item__c(
                name = qli.Product2.Name,
                Quote__c = qli.QuoteId,
                Product__c = qli.Product2Id,
                Quantity__c = qli.Quantity,
                UnitPrice__c = qli.UnitPrice,
                TotalPrice__c = qli.TotalPrice
            ));
        }
        if (!removedItems.isEmpty()) {
            insert removedItems;
        }
        
        if (!qlisToRemove.isEmpty()) {
            delete qlisToRemove;
        }
    }
}