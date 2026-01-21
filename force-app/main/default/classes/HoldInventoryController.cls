public with sharing class HoldInventoryController {


    public class QuoteLineItemWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String productName;
        @AuraEnabled public String family;
        @AuraEnabled public Decimal quantity;
        @AuraEnabled public Decimal onHold; 
    }

    @AuraEnabled(cacheable=true)
    public static List<QuoteLineItemWrapper> getQuoteLineItems(Id quoteId) {

        List<QuoteLineItem> qlis = [
            SELECT Id,
                   Quantity,
                   Product2Id,
                   Product2.Name,
                   Family__c
            FROM QuoteLineItem
            WHERE QuoteId = :quoteId
              AND Product2.Track_in_Inventory__c = true
        ];

        Set<Id> productIds = new Set<Id>();
        for (QuoteLineItem q : qlis) {
            productIds.add(q.Product2Id);
        }

        Map<Id, Decimal> onHoldByProduct = new Map<Id, Decimal>();

        for (AggregateResult ar : [
            SELECT Product__c productId,
                   SUM(Quantity) qty
            FROM ProductItemTransaction
            WHERE Product__c IN :productIds
              AND Quote__c = :quoteId
              AND On_Hold_Quantity__c = true
            GROUP BY Product__c
        ]) {
            onHoldByProduct.put(
                (Id) ar.get('productId'),
                Math.abs((Decimal) ar.get('qty'))
            );
        }

        List<QuoteLineItemWrapper> result = new List<QuoteLineItemWrapper>();

        for (QuoteLineItem qli : qlis) {
            QuoteLineItemWrapper wrap = new QuoteLineItemWrapper();
            wrap.id = qli.Id;
            wrap.productName = qli.Product2.Name;
            wrap.family = qli.Family__c;
            wrap.quantity = qli.Quantity;
            wrap.onHold = onHoldByProduct.containsKey(qli.Product2Id)
                ? onHoldByProduct.get(qli.Product2Id)
                : 0;
            result.add(wrap);
        }

        return result;
    }

    public class InventoryResult {
        @AuraEnabled public Id quoteLineItemId;
        @AuraEnabled public String productName;
        @AuraEnabled public String locationName;
        @AuraEnabled public Decimal availableQty;
        @AuraEnabled public Id productItemId;
        @AuraEnabled public Decimal inputQty;
        @AuraEnabled public Decimal quantityOnHold; 
        @AuraEnabled public Id productId;
        @AuraEnabled public Id locationId;
    }

    @AuraEnabled
    public static List<InventoryResult> checkInventory(List<Id> quoteLineItemIds) {

        if (quoteLineItemIds == null || quoteLineItemIds.isEmpty()) {
            return new List<InventoryResult>();
        }

        List<QuoteLineItem> qlis = [
            SELECT Id, Product2Id, Product2.Name, QuoteId
            FROM QuoteLineItem
            WHERE Id IN :quoteLineItemIds
        ];

        Id quoteId = qlis[0].QuoteId;

        Set<Id> productIds = new Set<Id>();
        for (QuoteLineItem q : qlis) {
            productIds.add(q.Product2Id);
        }

        Map<Id, List<ProductItem>> productItemMap = new Map<Id, List<ProductItem>>();

        for (ProductItem pi : [
            SELECT Id,
                   Product2Id,
                   QuantityOnHand,
                   Location.Name
            FROM ProductItem
            WHERE Product2Id IN :productIds
        ]) {
            if (!productItemMap.containsKey(pi.Product2Id)) {
                productItemMap.put(pi.Product2Id, new List<ProductItem>());
            }
            productItemMap.get(pi.Product2Id).add(pi);
        }

     
        Map<Id, Decimal> onHoldByProductItem = new Map<Id, Decimal>();

        for (AggregateResult ar : [
            SELECT ProductItemId,
                   SUM(Quantity) qty
            FROM ProductItemTransaction
            WHERE ProductItem.Product2Id IN :productIds
              AND Quote__c = :quoteId
              AND On_Hold_Quantity__c = true
            GROUP BY ProductItemId
        ]) {
            onHoldByProductItem.put(
                (Id) ar.get('ProductItemId'),
                Math.abs((Decimal) ar.get('qty'))
            );
        }

        List<InventoryResult> results = new List<InventoryResult>();

        for (QuoteLineItem qli : qlis) {

            List<ProductItem> productItems = productItemMap.get(qli.Product2Id);

            if (productItems == null) {
                InventoryResult ir = new InventoryResult();
                ir.quoteLineItemId = qli.Id;
                ir.productName = qli.Product2.Name;
                ir.locationName = '—';
                ir.availableQty = 0;
                ir.productItemId = null;
                ir.quantityOnHold = 0;
                ir.productId = qli.Product2Id;
                ir.inputQty = 0;
                results.add(ir);
                continue;
            }

            for (ProductItem pi : productItems) {
                InventoryResult ir = new InventoryResult();
                ir.quoteLineItemId = qli.Id;
                ir.productName = qli.Product2.Name;
                ir.locationName = pi.Location.Name;
                ir.locationId = pi.LocationId;
                ir.availableQty = pi.QuantityOnHand;
                ir.productItemId = pi.Id;
                ir.productId = qli.Product2Id;
                ir.quantityOnHold =
                    onHoldByProductItem.containsKey(pi.Id)
                        ? onHoldByProductItem.get(pi.Id)
                        : 0;
                ir.inputQty = 0;
                results.add(ir);
            }
        }

        return results;
    }
    
	@AuraEnabled
    public static void createProductItemTransactions(
        List<Id> productItemIds,
        List<Decimal> quantities,
        List<Id> productIds,
        list<Id> locationIds,
        Id quoteId
    ) {
        List<ProductItemTransaction> txs = new List<ProductItemTransaction>();

        for (Integer i = 0; i < productItemIds.size(); i++) {

            if (productItemIds[i] == null || quantities[i] <= 0) {
                continue;
            }

            ProductItemTransaction tx = new ProductItemTransaction();
            tx.ProductItemId = productItemIds[i];
            tx.Location__c = locationIds[i];
            tx.Product__c = productIds[i];
            tx.Quote__c = quoteId;
            tx.Quantity = -quantities[i]; 
            tx.TransactionType = 'Adjusted';
            tx.On_Hold_Quantity__c = true;

            txs.add(tx);
        }

        if (!txs.isEmpty()) {
            insert txs;
        }
    }
}