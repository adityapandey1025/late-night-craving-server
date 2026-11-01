"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDeliveryLocation = exports.updateDeliveryLocation = exports.createDeliveryLocation = exports.getAdminLocations = exports.getDashboardAnalytics = exports.updateAdminProfile = exports.toggleAdminAvailability = exports.getStoreAvailability = void 0;
const Admin_1 = require("../models/Admin");
const AdminAvailability_1 = require("../models/AdminAvailability");
const Order_1 = require("../models/Order");
const DeliveryLocation_1 = require("../models/DeliveryLocation");
const socketService_1 = require("../services/socketService");
// Get store availability status (public & admin)
const getStoreAvailability = async (req, res) => {
    try {
        const admins = await Admin_1.Admin.find({ isActive: true }).select('name availabilityStatus lastAvailabilityToggle upiId');
        const orderingEnabled = admins.some((a) => a.availabilityStatus === 'OPEN');
        res.json({
            success: true,
            orderingEnabled,
            message: orderingEnabled
                ? 'Store is open for late-night delivery!'
                : 'All administrators are currently offline. Ordering is temporarily closed.',
            admins: admins.map((a) => ({
                id: a._id,
                name: a.name,
                availabilityStatus: a.availabilityStatus,
                lastAvailabilityToggle: a.lastAvailabilityToggle,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve store availability' });
    }
};
exports.getStoreAvailability = getStoreAvailability;
// Admin: Toggle availability for the logged-in admin (Aditya or Amlesh)
const toggleAdminAvailability = async (req, res) => {
    try {
        const adminId = req.user?.id;
        const { status, reason } = req.body;
        const admin = await Admin_1.Admin.findById(adminId);
        if (!admin) {
            res.status(404).json({ success: false, message: 'Administrator not found' });
            return;
        }
        const previousStatus = admin.availabilityStatus;
        const newStatus = status || (previousStatus === 'OPEN' ? 'CLOSED' : 'OPEN');
        admin.availabilityStatus = newStatus;
        admin.lastAvailabilityToggle = new Date();
        await admin.save();
        // Log the toggle
        await AdminAvailability_1.AdminAvailabilityLog.create({
            adminId: admin._id,
            adminName: admin.name,
            previousStatus,
            newStatus,
            reason: reason || 'Toggled from admin dashboard',
            timestamp: new Date(),
        });
        const allAdmins = await Admin_1.Admin.find({ isActive: true }).select('name availabilityStatus lastAvailabilityToggle');
        const orderingEnabled = allAdmins.some((a) => a.availabilityStatus === 'OPEN');
        // Broadcast update via Socket.IO
        socketService_1.socketEvents.notifyAdminAvailability({
            admins: allAdmins,
            orderingEnabled,
        });
        res.json({
            success: true,
            message: `${admin.name} is now ${newStatus}.`,
            admin: {
                id: admin._id,
                name: admin.name,
                availabilityStatus: admin.availabilityStatus,
            },
            orderingEnabled,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle availability' });
    }
};
exports.toggleAdminAvailability = toggleAdminAvailability;
// Admin: Update profile & UPI details
const updateAdminProfile = async (req, res) => {
    try {
        const adminId = req.user?.id;
        const { upiId, upiName, phone, qrCodeUrl } = req.body;
        const admin = await Admin_1.Admin.findById(adminId);
        if (!admin) {
            res.status(404).json({ success: false, message: 'Admin not found' });
            return;
        }
        if (upiId)
            admin.upiId = upiId.trim();
        if (upiName)
            admin.upiName = upiName.trim();
        if (phone)
            admin.phone = phone.trim();
        if (qrCodeUrl !== undefined)
            admin.qrCodeUrl = qrCodeUrl;
        await admin.save();
        res.json({
            success: true,
            message: 'Admin profile updated successfully',
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                upiId: admin.upiId,
                upiName: admin.upiName,
                qrCodeUrl: admin.qrCodeUrl,
                availabilityStatus: admin.availabilityStatus,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
};
exports.updateAdminProfile = updateAdminProfile;
// Admin: Dashboard Analytics
const getDashboardAnalytics = async (req, res) => {
    try {
        const totalOrders = await Order_1.Order.countDocuments();
        const pendingAcceptance = await Order_1.Order.countDocuments({ status: 'PENDING_ADMIN_ACCEPTANCE' });
        const awaitingPayment = await Order_1.Order.countDocuments({ status: 'AWAITING_PAYMENT' });
        const inProgress = await Order_1.Order.countDocuments({
            status: { $in: ['PAYMENT_CONFIRMED', 'PREPARING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'] },
        });
        const deliveredOrders = await Order_1.Order.countDocuments({ status: 'DELIVERED' });
        // Aggregate revenue
        const revenueAgg = await Order_1.Order.aggregate([
            { $match: { status: 'DELIVERED' } },
            { $group: { _id: null, totalPaise: { $sum: '$pricing.orderTotal' } } },
        ]);
        const totalRevenuePaise = revenueAgg[0]?.totalPaise || 0;
        // Admin performance breakdown
        const admins = await Admin_1.Admin.find({ isActive: true });
        const adminStats = await Promise.all(admins.map(async (adm) => {
            const orderCount = await Order_1.Order.countDocuments({ assignedAdminId: adm._id });
            const completedCount = await Order_1.Order.countDocuments({ assignedAdminId: adm._id, status: 'DELIVERED' });
            return {
                adminId: adm._id,
                name: adm.name,
                availabilityStatus: adm.availabilityStatus,
                totalAssigned: orderCount,
                completed: completedCount,
            };
        }));
        res.json({
            success: true,
            analytics: {
                totalOrders,
                pendingAcceptance,
                awaitingPayment,
                inProgress,
                deliveredOrders,
                totalRevenuePaise,
                adminStats,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
};
exports.getDashboardAnalytics = getDashboardAnalytics;
// Delivery Locations Management (Admin)
const getAdminLocations = async (req, res) => {
    try {
        const locations = await DeliveryLocation_1.DeliveryLocation.find().sort({ displayOrder: 1 });
        res.json({ success: true, locations });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch delivery locations' });
    }
};
exports.getAdminLocations = getAdminLocations;
const createDeliveryLocation = async (req, res) => {
    try {
        const { name, description, estimatedDeliveryMinutes, displayOrder, isActive } = req.body;
        if (!name) {
            res.status(400).json({ success: false, message: 'Location name is required' });
            return;
        }
        const location = await DeliveryLocation_1.DeliveryLocation.create({
            name,
            description: description || '',
            estimatedDeliveryMinutes: Number(estimatedDeliveryMinutes) || 25,
            displayOrder: Number(displayOrder) || 0,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
        });
        res.status(201).json({ success: true, message: 'Delivery location added', location });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create delivery location' });
    }
};
exports.createDeliveryLocation = createDeliveryLocation;
const updateDeliveryLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const location = await DeliveryLocation_1.DeliveryLocation.findByIdAndUpdate(id, req.body, { new: true });
        if (!location) {
            res.status(404).json({ success: false, message: 'Delivery location not found' });
            return;
        }
        res.json({ success: true, message: 'Delivery location updated', location });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update location' });
    }
};
exports.updateDeliveryLocation = updateDeliveryLocation;
const deleteDeliveryLocation = async (req, res) => {
    try {
        const { id } = req.params;
        await DeliveryLocation_1.DeliveryLocation.findByIdAndDelete(id);
        res.json({ success: true, message: 'Delivery location removed' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove location' });
    }
};
exports.deleteDeliveryLocation = deleteDeliveryLocation;
