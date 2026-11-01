"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUPIUrl = generateUPIUrl;
exports.generateUPIQRCodeDataUrl = generateUPIQRCodeDataUrl;
const qrcode_1 = __importDefault(require("qrcode"));
function generateUPIUrl(details) {
    const amountRupees = (details.amountPaise / 100).toFixed(2);
    const encodedName = encodeURIComponent(details.name);
    const note = encodeURIComponent(`Order ${details.orderNumber} advance`);
    return `upi://pay?pa=${details.upiId}&pn=${encodedName}&am=${amountRupees}&cu=INR&tn=${note}`;
}
async function generateUPIQRCodeDataUrl(details) {
    const upiUrl = generateUPIUrl(details);
    try {
        const dataUrl = await qrcode_1.default.toDataURL(upiUrl, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320,
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
        });
        return dataUrl;
    }
    catch (err) {
        console.error('Failed to generate QR code data URL:', err);
        return '';
    }
}
