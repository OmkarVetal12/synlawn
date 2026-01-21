public with sharing class WorkOrderInventoryController {

    public class HeldInventoryItem {
        @AuraEnabled public Id productItemId;
        @AuraEnabled public String productName;
        @AuraEnabled public String locationName;
        @AuraEnabled public Decimal quantityOnHold;
        @AuraEnabled public Decimal quantityToConsume;
         @AuraEnabled public Id quoteId;
           @AuraEnabled public Id locationId;   
    }

    @AuraEnabled(cacheable=true)
    public static List<HeldInventoryItem> getHeldInventory(Id workOrderId) {

        WorkOrder workOrder = [
            SELECT Quote__c
            FROM WorkOrder
            WHERE Id = :workOrderId
            LIMIT 1
        ];

        if (workOrder.Quote__c == null) {
            return new List<HeldInventoryItem>();
        }
        
        AggregateResult[] heldResults = [
            SELECT ProductItemId,
                   SUM(Quantity) totalQuantity
            FROM ProductItemTransaction
            WHERE Quote__c = :workOrder.Quote__c  AND On_Hold_Quantity__c = true
            GROUP BY ProductItemId
            HAVING SUM(Quantity) < 0
        ];

        Set<Id> productItemIds = new Set<Id>();
        for (AggregateResult result : heldResults) {
            productItemIds.add((Id) result.get('ProductItemId'));
        }

        Map<Id, ProductItem> productItemMap = new Map<Id, ProductItem>([
            SELECT Id, Product2.Name, Location.Name,LocationId
            FROM ProductItem
            WHERE Id IN :productItemIds
        ]);

        List<HeldInventoryItem> response = new List<HeldInventoryItem>();

        for (AggregateResult result : heldResults) {
            Id productItemId = (Id) result.get('ProductItemId');
            Decimal heldQuantity = Math.abs((Decimal) result.get('totalQuantity'));

            ProductItem productItem = productItemMap.get(productItemId);

            HeldInventoryItem item = new HeldInventoryItem();
            item.productItemId = productItemId;
            item.productName = productItem.Product2.Name;
            item.locationName = productItem.Location.Name;
            item.quantityOnHold = heldQuantity;
            item.quantityToConsume = 0;
			item.quoteId = workOrder.Quote__c;
            item.locationId = productItem.LocationId;
            response.add(item);
        }

        return response;
    }

    @AuraEnabled
    public static void consumeInventory(
        Id workOrderId,
        Id quoteId,
        List<Id> productItemIds,
        List<Decimal> quantities,
        List<Id> locationIds
    ) {
        List<ProductItemTransaction> inventoryTransactions = new List<ProductItemTransaction>();
        List<ProductConsumed> consumedProducts = new List<ProductConsumed>();

         system.debug('locationIds'+locationIds);
        for (Integer index = 0; index < productItemIds.size(); index++) {
            Decimal quantity = quantities[index];
            if (quantity == null || quantity <= 0) continue;

            ProductItemTransaction transactionRec = new ProductItemTransaction();
            transactionRec.ProductItemId = productItemIds[index];
            transactionRec.Location__c = locationIds[index];
            transactionRec.Quantity = quantity;
            transactionRec.Quote__c = quoteId;
            transactionRec.TransactionType = 'adjusted';
            transactionRec.On_Hold_Quantity__c = true;
            inventoryTransactions.add(transactionRec);

            ProductConsumed consumed = new ProductConsumed();
            consumed.WorkOrderId = workOrderId;
            consumed.ProductItemId = productItemIds[index];
            consumed.QuantityConsumed = quantity;
            consumedProducts.add(consumed);
        }

        insert inventoryTransactions;
        insert consumedProducts;
        system.debug('consumedProducts'+consumedProducts);
        system.debug('inventoryTransactions'+inventoryTransactions);
    }
}