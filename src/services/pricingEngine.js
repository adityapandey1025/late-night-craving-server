"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDeliveryFee = calculateDeliveryFee;
exports.calculateOrderBill = calculateOrderBill;
exports.paiseToRupees = paiseToRupees;
exports.rupeesToPaise = rupeesToPaise;
/**
 * Calculates delivery fee in paise based on subtotal in paise.
 * Subtotal rules:
 * - Below ₹99 (< 9900 paise): ₹30 (3000 paise)
 * - ₹99–₹149.99 (9900 to 14999 paise): ₹40 (4000 paise)
 * - ₹150–₹299.99 (15000 to 29999 paise): ₹60 (6000 paise)
 * - ₹300 and above (>= 30000 paise): ₹60 (6000 paise)
 */
function calculateDeliveryFee(subtotalPaise) {
    if (subtotalPaise < 9900) {
        return 3000;
    }
    else if (subtotalPaise < 15000) {
        return 4000;
    }
    else {
        return 6000;
    }
}
/**
 * Calculates the complete bill breakdown using integer paise.
 */
function calculateOrderBill(items, surchargePaise = 0) {
    let productSubtotal = 0;
    let onlineAdvanceRequired = 0;
    const processedItems = items.map((item) => {
        // Quantity pricing: first unit at 1x; every additional unit at 1.5x.
        const quantityMultiplier = item.quantity <= 1 ? 1 : 1 + (item.quantity - 1) * 1.5;
        const itemTotal = Math.round(item.price * quantityMultiplier);
        productSubtotal += itemTotal;
        let advanceRequired = 0;
        if (item.paymentPolicy === 'FULL_PAYMENT') {
            advanceRequired = itemTotal;
        }
        else if (item.paymentPolicy === 'PARTIAL_PAYMENT') {
            const pct = item.partialPaymentPercentage ?? 40;
            // Round to nearest integer paise
            advanceRequired = Math.round((itemTotal * pct) / 100);
        }
        else if (item.paymentPolicy === 'NO_ONLINE_PAYMENT') {
            advanceRequired = 0;
        }
        onlineAdvanceRequired += advanceRequired;
        return {
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            productType: item.productType,
            paymentPolicy: item.paymentPolicy,
            itemTotal,
            advanceRequired,
        };
    });
    const deliveryFee = calculateDeliveryFee(productSubtotal);
    const fastFoodSurcharge = 0;
    const orderTotal = productSubtotal + deliveryFee + fastFoodSurcharge;
    // Remaining balance = Order total - online advance
    // Per spec: The remaining balance includes any unpaid delivery fee and surcharge,
    // not just the unpaid product amount.
    const remainingBalance = Math.max(0, orderTotal - onlineAdvanceRequired);
    return {
        productSubtotal,
        deliveryFee,
        fastFoodSurcharge,
        orderTotal,
        onlineAdvanceRequired,
        remainingBalance,
        items: processedItems,
    };
}
/**
 * Helper to convert paise to Rupees string for display.
 * e.g., 25000 -> "250.00", 3000 -> "30.00"
 */
function paiseToRupees(paise) {
    return Number((paise / 100).toFixed(2));
}
/**
 * Helper to convert Rupee amount to integer paise.
 */
function rupeesToPaise(rupees) {
    return Math.round(rupees * 100);
}
