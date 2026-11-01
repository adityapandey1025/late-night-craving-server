"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const OrderItemSnapshotSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    productType: { type: String, enum: ['PACKAGED', 'FAST_FOOD'], required: true },
    paymentPolicy: {
        type: String,
        enum: ['PARTIAL_PAYMENT', 'FULL_PAYMENT', 'NO_ONLINE_PAYMENT'],
        required: true,
    },
    itemTotal: { type: Number, required: true },
    advanceRequired: { type: Number, required: true },
}, { _id: false });
const OrderStatusHistorySchema = new mongoose_1.Schema({
    status: { type: String, required: true },
    changedBy: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    changedByRole: { type: String, enum: ['admin', 'customer', 'system'], required: true },
    actorName: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
}, { _id: false });
const OrderSchema = new mongoose_1.Schema({
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerSnapshot: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, default: '' },
    },
    deliveryAddress: {
        fullAddress: { type: String, required: true },
        landmark: { type: String, default: '' },
        locationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'DeliveryLocation', required: true },
        locationName: { type: String, required: true },
    },
    deliveryInstructions: { type: String, default: '' },
    items: [OrderItemSnapshotSchema],
    pricing: {
        productSubtotal: { type: Number, required: true },
        deliveryFee: { type: Number, required: true },
        fastFoodSurcharge: { type: Number, default: 0 },
        orderTotal: { type: Number, required: true },
        onlineAdvanceRequired: { type: Number, required: true },
        remainingBalance: { type: Number, required: true },
        isSurchargeAcknowledged: { type: Boolean, default: true },
    },
    status: {
        type: String,
        enum: [
            'PENDING_ADMIN_ACCEPTANCE',
            'REJECTED',
            'AWAITING_PAYMENT',
            'PAYMENT_CONFIRMED',
            'PREPARING',
            'READY_FOR_DELIVERY',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED',
        ],
        default: 'PENDING_ADMIN_ACCEPTANCE',
        index: true,
    },
    statusHistory: [OrderStatusHistorySchema],
    assignedAdminId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Admin', default: null, index: true },
    assignedAdminSnapshot: {
        name: { type: String },
        phone: { type: String },
        upiId: { type: String },
        upiName: { type: String },
        qrCodeUrl: { type: String },
    },
    estimatedDeliveryTime: { type: Date, default: null },
    whatsappSharingUnlocked: { type: Boolean, default: false },
    rejectionReason: { type: String, default: '' },
    cancellationReason: { type: String, default: '' },
}, { timestamps: true });
exports.Order = mongoose_1.default.model('Order', OrderSchema);
