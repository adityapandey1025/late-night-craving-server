"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNewOrderAlert = sendNewOrderAlert;
exports.sendPaymentAlert = sendPaymentAlert;
const twilio_1 = __importDefault(require("twilio"));
let twilioClient;
function configuredRecipients(value) {
    return (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
function normalizeWhatsAppAddress(value) {
    const trimmed = value.trim();
    return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}
function getTwilioClient() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN)
        return null;
    if (!twilioClient)
        twilioClient = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    return twilioClient;
}
async function sendPaymentAlert(details) {
    return sendAlert(`lateNightCraving: New payment submission for Order ${details.orderNumber}; customer ${details.customerName}; expected ₹${(details.amount / 100).toFixed(2)}; UTR ${details.reference || 'not provided'}. Check the admin dashboard.`, 'payment');
}
async function sendNewOrderAlert(details) {
    return sendAlert(`lateNightCraving: New order ${details.orderNumber} from ${details.customerName}; recipient phone ${details.customerPhone}; order total ₹${(details.amount / 100).toFixed(2)}. Open the admin dashboard to accept or reject it.`, 'order');
}
async function sendAlert(body, alertType) {
    const client = getTwilioClient();
    if (!client) {
        console.warn(`Twilio ${alertType} alert skipped: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required.`);
        return { skipped: true, reason: 'missing_credentials' };
    }
    const jobs = [];
    if (process.env.ALERT_TO_WHATSAPP && process.env.TWILIO_WHATSAPP_FROM) {
        const from = normalizeWhatsAppAddress(process.env.TWILIO_WHATSAPP_FROM);
        const recipients = configuredRecipients(process.env.ALERT_TO_WHATSAPP)
            .map(normalizeWhatsAppAddress);
        recipients.forEach((to) => jobs.push(client.messages.create({ from, to, body })));
    }
    if (String(process.env.TWILIO_ENABLE_CALLS).toLowerCase() === 'true' && process.env.ALERT_TO_PHONE && process.env.TWILIO_CALL_FROM) {
        const callUrl = process.env.TWILIO_CALL_URL || 'http://demo.twilio.com/docs/voice.xml';
        const recipients = process.env.ALERT_TO_PHONE.split(',').map((value) => value.trim()).filter(Boolean);
        recipients.forEach((to) => jobs.push(client.calls.create({
            from: process.env.TWILIO_CALL_FROM,
            to,
            url: callUrl,
        })));
    }
    if (jobs.length === 0) {
        console.warn(`Twilio ${alertType} alert skipped: no WhatsApp or voice recipients are configured.`);
        return { skipped: true, reason: 'missing_recipients' };
    }
    const results = await Promise.allSettled(jobs);
    results.forEach((result) => {
        if (result.status === 'rejected') {
            const error = result.reason;
            console.error('Twilio alert failed:', {
                message: error?.message || String(error),
                code: error?.code,
                status: error?.status,
                moreInfo: error?.moreInfo,
            });
        }
    });
    const summary = {
        sent: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
    };
    console.info(`Twilio ${alertType} alert result: ${summary.sent} sent, ${summary.failed} failed.`);
    return summary;
}
