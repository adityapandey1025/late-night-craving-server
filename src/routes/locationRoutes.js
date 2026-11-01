"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DeliveryLocation_1 = require("../models/DeliveryLocation");
const router = (0, express_1.Router)();
// Public: Get all active delivery areas (Per Spec 1 & 9: Customers can browse without logging in)
router.get('/', async (req, res) => {
    try {
        const locations = await DeliveryLocation_1.DeliveryLocation.find({ isActive: true }).sort({ displayOrder: 1 });
        res.json({ success: true, locations });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch delivery locations' });
    }
});
exports.default = router;
