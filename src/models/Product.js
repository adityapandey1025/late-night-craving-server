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
exports.Product = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ProductSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    images: [{ type: String }],
    categoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', required: true },
    productType: { type: String, enum: ['PACKAGED', 'FAST_FOOD'], required: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    availability: { type: Boolean, default: true },
    inventory: { type: Number, default: null },
    isFeatured: { type: Boolean, default: false },
    paymentPolicy: {
        type: String,
        enum: ['PARTIAL_PAYMENT', 'FULL_PAYMENT', 'NO_ONLINE_PAYMENT'],
        default: 'PARTIAL_PAYMENT',
    },
    partialPaymentPercentage: { type: Number, default: 40, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
exports.Product = mongoose_1.default.model('Product', ProductSchema);
