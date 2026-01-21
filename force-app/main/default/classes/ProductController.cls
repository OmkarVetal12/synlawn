public with sharing class ProductController {

    @AuraEnabled public String Id {get;set;}
    @AuraEnabled public String locationName {get;set;}
    @AuraEnabled public Decimal quantityOnHand {get;set;}
    @AuraEnabled public String quality {get;set;}
    @AuraEnabled public Decimal quantityToReserve {get;set;}
    @AuraEnabled public String productFamily {get;set;}
    @AuraEnabled public String productName {get;set;}

    ProductController(ProductItem pi) {
        Id = pi.Id;
        locationName = pi.Location_Name__c;
        quantityOnHand = pi.QuantityOnHand;
        quality = pi.Quality__c;
        quantityToReserve = pi.Quantity_to_Reserve__c;
        productFamily = pi.Product_Family__c;
        productName = pi.Product2.Name;
    }

    @AuraEnabled
    public static List<ProductController> getProductItemsByQuoteLineItemIds(List<Id> Product2Ids) {
        System.debug('Product2Id Ids received: ' + Product2Ids);
        if (Product2Ids == null || Product2Ids.isEmpty()) {
            return new List<ProductController>();
        }

        // collect Product2Ids from the QuoteLineItems
        List<ProductItem> productItemsList = 
            [SELECT Id, Location_Name__c, QuantityOnHand, Quality__c, Quantity_to_Reserve__c, Product_Family__c, Product2.Name
            FROM ProductItem
            WHERE Product2Id IN :product2Ids
        ];

        List<ProductController> productItems = new List<ProductController>();

        for (ProductItem pi : productItemsList) { 
            productItems.add(new ProductController(pi));
        }

        System.debug('Product Items received for QLI Ids: ' + productItems);
        return productItems;
    }

    @AuraEnabled
    public static List<ProductItem> getProductItemsByProductId(String productId) {
        System.debug('Product Id received: ' + productId);
        List<ProductItem> productItems =  [
            SELECT Location_Name__c, QuantityOnHand, Quality__c, Quantity_to_Reserve__c,Product2Id,Product_Family__c,Product2.Name
            FROM ProductItem
            WHERE Product2Id = :productId];

        System.debug('Product Items received: ' + productItems);
        return productItems;
    }

    @AuraEnabled
    public static void insertProductItemsByProductId(String productId, Integer quantityToReserve, String quoteId) {
        System.debug('Product Id received: ' + productId);        
        try{
            ProductItemTransaction productItemTransactionInsert = new ProductItemTransaction(
                On_Hold_Quantity__c = true,
                Quote__c = quoteId,
                TransactionType = 'Adjusted',
                Quantity = quantityToReserve,
                ProductItemId = productId
            );        

            insert productItemTransactionInsert;

        } catch(Exception e){
            System.debug('Error inserting Product Item Transaction: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static ProductItem getProductItemId(String productId) {
        System.debug('Product Id received: ' + productId);
        return [
            SELECT Location_Name__c, QuantityOnHand, Quality__c, Quantity_to_Reserve__c
            FROM ProductItem
            WHERE Id = :productId
        ];
    }

    @AuraEnabled
    public static Integer getProductItemsCountByProductId(String productId) {
        System.debug('Product Id received: ' + productId);
        return [
            SELECT COUNT()
            FROM ProductItem
            WHERE Product2Id = :productId
        ];
    }

    @AuraEnabled
    public static ProductItem getAvailableCountById(String id) {
        System.debug('Product Id received: ' + id);
        return [
            SELECT QuantityOnHand
            FROM ProductItem
            WHERE Id = :id
        ];
    }

    



  
}