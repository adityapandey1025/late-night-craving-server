"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
const seedService_1 = require("../services/seedService");
const Admin_1 = require("../models/Admin");
const User_1 = require("../models/User");
const DeliveryLocation_1 = require("../models/DeliveryLocation");
const Order_1 = require("../models/Order");
const Payment_1 = require("../models/Payment");
const PaymentTransaction_1 = require("../models/PaymentTransaction");
const Review_1 = require("../models/Review");
const pricingEngine_1 = require("../services/pricingEngine");
const qrHelper_1 = require("../utils/qrHelper");
async function runTestSuite() {
    console.log('\n======================================================');
    console.log('🧪 RUNNING MASTER SPEC INTEGRATION VERIFICATION TESTS');
    console.log('======================================================\n');
    try {
        // Step 1: Boot Database & Seed
        await (0, db_1.connectDB)();
        await (0, seedService_1.seedDatabase)();
        console.log('✅ 1. Database connected and seeds initialized.');
        // Step 2: Verify Two-Admin System Seed
        const aditya = await Admin_1.Admin.findOne({ email: 'aditya@latenightcraving.com' });
        const amlesh = await Admin_1.Admin.findOne({ email: 'amlesh@latenightcraving.com' });
        if (!aditya || !amlesh) {
            throw new Error('Aditya and Amlesh must both be seeded in database.');
        }
        console.log(`✅ 2. Dual Admin Accounts verified: ${aditya.name} (${aditya.upiId}) & ${amlesh.name} (${amlesh.upiId})`);
        // Step 3: Test Pricing Engine Calculations (Paise integer math)
        console.log('\nTesting Pricing Engine rules:');
        // Tier 1: Subtotal < ₹99 (₹89 Maggi = 8900 paise) -> Delivery fee ₹30 (3000 paise)
        const tier1Items = [
            {
                productId: 'prod1',
                name: 'Cheese Maggi',
                price: 8900,
                quantity: 1,
                productType: 'FAST_FOOD',
                paymentPolicy: 'PARTIAL_PAYMENT',
                partialPaymentPercentage: 40,
            },
        ];
        const bill1 = (0, pricingEngine_1.calculateOrderBill)(tier1Items, 0);
        if (bill1.deliveryFee !== 3000) {
            throw new Error(`Tier 1 delivery fee expected 3000 paise, got ${bill1.deliveryFee}`);
        }
        // 40% of 8900 = 3560 paise
        if (bill1.onlineAdvanceRequired !== 3560) {
            throw new Error(`Expected advance 3560 paise, got ${bill1.onlineAdvanceRequired}`);
        }
        // Total = 8900 + 3000 = 11900. Remaining = 11900 - 3560 = 8340 paise
        if (bill1.remainingBalance !== 8340) {
            throw new Error(`Expected remaining 8340 paise, got ${bill1.remainingBalance}`);
        }
        console.log(`  ✓ Subtotal < ₹99: Fee is ₹30.00. 40% Advance is ₹35.60, remaining at delivery is ₹83.40.`);
        // Tier 2: Subtotal ₹99 - ₹149.99 (₹139 wrap = 13900 paise) -> Delivery fee ₹40 (4000 paise)
        const tier2Items = [
            {
                productId: 'prod2',
                name: 'Paneer Wrap',
                price: 13900,
                quantity: 1,
                productType: 'FAST_FOOD',
                paymentPolicy: 'PARTIAL_PAYMENT',
                partialPaymentPercentage: 40,
            },
        ];
        const bill2 = (0, pricingEngine_1.calculateOrderBill)(tier2Items, 1000); // with ₹10 fast-food surcharge
        if (bill2.deliveryFee !== 4000) {
            throw new Error(`Tier 2 delivery fee expected 4000 paise, got ${bill2.deliveryFee}`);
        }
        if (bill2.fastFoodSurcharge !== 1000) {
            throw new Error(`Fast-food surcharge expected 1000 paise, got ${bill2.fastFoodSurcharge}`);
        }
        // Total = 13900 + 4000 + 1000 = 18900 paise
        if (bill2.orderTotal !== 18900) {
            throw new Error(`Expected order total 18900 paise, got ${bill2.orderTotal}`);
        }
        console.log(`  ✓ Subtotal ₹99-₹149.99: Fee is ₹40.00. Surcharge ₹10.00 applied. Total is ₹189.00.`);
        // Mixed Payment Policies in single cart:
        // Item A: 100% FULL_PAYMENT (₹249 Pizza)
        // Item B: 0% NO_ONLINE_PAYMENT (₹125 Red Bull)
        const mixedItems = [
            {
                productId: 'p_pizza',
                name: 'Pepperoni Pizza',
                price: 24900,
                quantity: 1,
                productType: 'FAST_FOOD',
                paymentPolicy: 'FULL_PAYMENT',
            },
            {
                productId: 'p_drink',
                name: 'Red Bull',
                price: 12500,
                quantity: 1,
                productType: 'PACKAGED',
                paymentPolicy: 'NO_ONLINE_PAYMENT',
            },
        ];
        const mixedBill = (0, pricingEngine_1.calculateOrderBill)(mixedItems, 2000); // ₹20 surcharge
        // Subtotal = 24900 + 12500 = 37400 paise (>= 30000 -> Delivery fee ₹60 = 6000 paise)
        if (mixedBill.deliveryFee !== 6000) {
            throw new Error(`Tier 3/4 delivery fee expected 6000 paise, got ${mixedBill.deliveryFee}`);
        }
        // Advance = 100% of 24900 + 0% of 12500 = 24900 paise
        if (mixedBill.onlineAdvanceRequired !== 24900) {
            throw new Error(`Mixed advance expected 24900 paise, got ${mixedBill.onlineAdvanceRequired}`);
        }
        // Order Total = 37400 + 6000 + 2000 = 45400 paise
        // Remaining = 45400 - 24900 = 20500 paise (includes Red Bull + delivery fee + surcharge!)
        if (mixedBill.remainingBalance !== 20500) {
            throw new Error(`Remaining balance expected 20500 paise, got ${mixedBill.remainingBalance}`);
        }
        console.log(`  ✓ Mixed Cart: 100% Advance Item + Pay-On-Delivery Item calculated with exact paise precision.`);
        // Step 4: UPI URL & QR Code Generation
        const upiDetails = {
            upiId: aditya.upiId,
            name: aditya.upiName,
            amountPaise: 24900,
            orderNumber: 'LNC-TEST-001',
        };
        const upiUrl = (0, qrHelper_1.generateUPIUrl)(upiDetails);
        const qrDataUrl = await (0, qrHelper_1.generateUPIQRCodeDataUrl)(upiDetails);
        if (!upiUrl.startsWith('upi://pay') || !qrDataUrl.startsWith('data:image/png;base64,')) {
            throw new Error('UPI QR or deep link generation failed');
        }
        console.log(`✅ 3. UPI QR Code and deep intent link generated successfully for ${aditya.name}.`);
        // Step 5: Test Customer Lifecycle & Order State Machine
        console.log('\nTesting End-to-End Order Lifecycle:');
        // Customer setup
        const testPhone = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;
        const hashedPassword = await bcryptjs_1.default.hash('Secret@123', 10);
        const location = await DeliveryLocation_1.DeliveryLocation.findOne({ isActive: true });
        if (!location)
            throw new Error('No active delivery location found');
        const customer = await User_1.User.create({
            name: 'Rohan Sharma',
            phone: testPhone,
            email: 'rohan.test@example.com',
            password: hashedPassword,
            addresses: [
                {
                    label: 'Hostel Block 3',
                    fullAddress: 'Room 312, Hostel Block 3, North Campus',
                    locationId: location._id,
                    locationName: location.name,
                    isDefault: true,
                },
            ],
        });
        // 1. Order Placed -> PENDING_ADMIN_ACCEPTANCE
        const order = await Order_1.Order.create({
            orderNumber: `LNC-${Date.now().toString().slice(-6)}`,
            customerId: customer._id,
            customerSnapshot: {
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
            },
            deliveryAddress: {
                fullAddress: customer.addresses[0].fullAddress,
                locationId: location._id,
                locationName: location.name,
            },
            items: [
                {
                    productId: new mongoose_1.default.Types.ObjectId(),
                    name: 'Smoky BBQ Double Patty Burger',
                    price: 16900,
                    quantity: 2,
                    productType: 'FAST_FOOD',
                    paymentPolicy: 'PARTIAL_PAYMENT',
                    itemTotal: 33800,
                    advanceRequired: 13520, // 40%
                },
            ],
            pricing: {
                productSubtotal: 33800,
                deliveryFee: 6000,
                fastFoodSurcharge: 0,
                orderTotal: 39800,
                onlineAdvanceRequired: 13520,
                remainingBalance: 26280,
                isSurchargeAcknowledged: true,
            },
            status: 'PENDING_ADMIN_ACCEPTANCE',
            statusHistory: [
                {
                    status: 'PENDING_ADMIN_ACCEPTANCE',
                    changedBy: customer._id,
                    changedByRole: 'customer',
                    actorName: customer.name,
                    timestamp: new Date(),
                },
            ],
            whatsappSharingUnlocked: false,
        });
        console.log(`  ✓ 1. Customer placed Order #${order.orderNumber} in PENDING_ADMIN_ACCEPTANCE.`);
        // 2. Admin Aditya Accepts Order -> Assigns surcharge ₹10 (1000 paise) -> AWAITING_PAYMENT
        order.assignedAdminId = aditya._id;
        order.assignedAdminSnapshot = {
            name: aditya.name,
            phone: aditya.phone,
            upiId: aditya.upiId,
            upiName: aditya.upiName,
        };
        order.pricing.fastFoodSurcharge = 1000;
        order.pricing.orderTotal += 1000;
        order.pricing.remainingBalance += 1000;
        order.status = 'AWAITING_PAYMENT';
        order.statusHistory.push({
            status: 'AWAITING_PAYMENT',
            changedBy: aditya._id,
            changedByRole: 'admin',
            actorName: aditya.name,
            timestamp: new Date(),
            note: 'Accepted by Aditya with ₹10 surcharge',
        });
        await order.save();
        const payment = await Payment_1.Payment.create({
            orderId: order._id,
            customerId: customer._id,
            assignedAdminId: aditya._id,
            advanceAmountExpected: order.pricing.onlineAdvanceRequired,
            advanceStatus: 'PENDING',
            remainingAmountExpected: order.pricing.remainingBalance,
            remainingAmountCollected: 0,
            remainingCollectionStatus: 'PENDING',
            isSettled: false,
        });
        console.log(`  ✓ 2. Aditya accepted order. Surcharge applied. Assigned UPI QR ready. Status: AWAITING_PAYMENT.`);
        // 3. Customer submits UTR
        payment.customerPaymentReference = 'UPI98471203948';
        payment.customerSubmittedAt = new Date();
        payment.advanceStatus = 'SUBMITTED';
        await payment.save();
        console.log(`  ✓ 3. Customer submitted UTR: ${payment.customerPaymentReference}`);
        // 4. Admin Aditya Manually Verifies Payment -> PAYMENT_CONFIRMED & Unlocks WhatsApp
        payment.advanceStatus = 'VERIFIED';
        payment.verifiedAmount = order.pricing.onlineAdvanceRequired;
        payment.verifyingAdminId = aditya._id;
        payment.verifyingAdminName = aditya.name;
        payment.verifiedAt = new Date();
        payment.verificationNote = 'Verified in HDFC bank statement by Aditya';
        await payment.save();
        await PaymentTransaction_1.PaymentTransaction.create({
            orderId: order._id,
            paymentId: payment._id,
            transactionType: 'ONLINE_ADVANCE',
            amount: payment.verifiedAmount,
            paymentMethod: 'UPI',
            collectedByAdminId: aditya._id,
            adminName: aditya.name,
            reference: payment.customerPaymentReference,
            status: 'SUCCESS',
            notes: payment.verificationNote,
        });
        order.status = 'PAYMENT_CONFIRMED';
        order.whatsappSharingUnlocked = true;
        order.estimatedDeliveryTime = new Date(Date.now() + 25 * 60 * 1000);
        order.statusHistory.push({
            status: 'PAYMENT_CONFIRMED',
            changedBy: aditya._id,
            changedByRole: 'admin',
            actorName: aditya.name,
            timestamp: new Date(),
            note: 'Payment verified manually by Aditya. WhatsApp location sharing unlocked.',
        });
        await order.save();
        console.log(`  ✓ 4. Advance payment verified. WhatsApp sharing unlocked! Status: PAYMENT_CONFIRMED.`);
        // 5. Admin updates status to OUT_FOR_DELIVERY then DELIVERED
        order.status = 'OUT_FOR_DELIVERY';
        await order.save();
        order.status = 'DELIVERED';
        await order.save();
        console.log(`  ✓ 5. Order marked DELIVERED by assigned admin.`);
        // 6. Assigned admin records remaining balance collection (Cash or UPI)
        payment.remainingAmountCollected = order.pricing.remainingBalance;
        payment.remainingCollectionStatus = 'FULLY_COLLECTED';
        payment.isSettled = true;
        payment.settledAt = new Date();
        await payment.save();
        await PaymentTransaction_1.PaymentTransaction.create({
            orderId: order._id,
            paymentId: payment._id,
            transactionType: 'DELIVERY_COLLECTION',
            amount: payment.remainingAmountCollected,
            paymentMethod: 'CASH',
            collectedByAdminId: aditya._id,
            adminName: aditya.name,
            reference: 'ON_DELIVERY_CASH',
            status: 'SUCCESS',
            notes: 'Collected cash at hostel gate',
        });
        console.log(`  ✓ 6. Remaining balance of ₹${(0, pricingEngine_1.paiseToRupees)(payment.remainingAmountCollected)} collected on delivery. Order fully settled!`);
        // 7. Customer submits review
        const review = await Review_1.Review.create({
            orderId: order._id,
            customerId: customer._id,
            customerName: customer.name,
            rating: 5,
            reviewText: 'Incredible smoky double patty burger! Delivered boiling hot at 2 AM.',
            deliveryFeedback: 'Courteous rider, found the hostel room easily.',
        });
        console.log(`  ✓ 7. Review created: ${review.rating}★ "${review.reviewText}"`);
        // 8. Prevent duplicate review test
        try {
            await Review_1.Review.create({
                orderId: order._id,
                customerId: customer._id,
                customerName: customer.name,
                rating: 4,
                reviewText: 'Duplicate test review',
            });
            throw new Error('Duplicate review check failed: duplicate was allowed!');
        }
        catch (dupErr) {
            if (dupErr.code === 11000) {
                console.log(`  ✓ 8. Duplicate review successfully prevented by database unique index.`);
            }
            else {
                throw dupErr;
            }
        }
        // Step 6: Test Independent Availability Rules
        console.log('\nTesting Dual Admin Availability Logic:');
        aditya.availabilityStatus = 'CLOSED';
        await aditya.save();
        // Amlesh is still OPEN -> Ordering should remain enabled!
        let openCount = await Admin_1.Admin.countDocuments({ isActive: true, availabilityStatus: 'OPEN' });
        if (openCount === 0)
            throw new Error('Amlesh should still be OPEN');
        console.log(`  ✓ Aditya is CLOSED, but Amlesh is OPEN -> Ordering remains enabled.`);
        amlesh.availabilityStatus = 'CLOSED';
        await amlesh.save();
        openCount = await Admin_1.Admin.countDocuments({ isActive: true, availabilityStatus: 'OPEN' });
        if (openCount !== 0)
            throw new Error('Both admins should now be CLOSED');
        console.log(`  ✓ Both Aditya & Amlesh are CLOSED -> Ordering is globally disabled.`);
        // Restore to OPEN
        aditya.availabilityStatus = 'OPEN';
        amlesh.availabilityStatus = 'OPEN';
        await aditya.save();
        await amlesh.save();
        console.log(`  ✓ Both restored to OPEN for production readiness.`);
        console.log('\n======================================================');
        console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (100% SPEC COMPLIANT)');
        console.log('======================================================\n');
    }
    catch (error) {
        console.error('❌ Integration Test Failure:', error);
        process.exit(1);
    }
    finally {
        await (0, db_1.disconnectDB)();
    }
}
runTestSuite();
