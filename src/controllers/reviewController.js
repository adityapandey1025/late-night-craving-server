"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicReviews = exports.createReview = void 0;
const Review_1 = require("../models/Review");
const Order_1 = require("../models/Order");
// Customer: Submit review for a delivered order
const createReview = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { orderId, rating, reviewText, deliveryFeedback } = req.body;
        if (!orderId || !rating || !reviewText) {
            res.status(400).json({ success: false, message: 'Rating and review comment are required' });
            return;
        }
        if (rating < 1 || rating > 5) {
            res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars' });
            return;
        }
        // Verify order exists, belongs to this customer, and is DELIVERED
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        if (order.customerId.toString() !== userId) {
            res.status(403).json({ success: false, message: 'You can only review orders placed by your account.' });
            return;
        }
        if (order.status !== 'DELIVERED') {
            res.status(400).json({
                success: false,
                message: 'Reviews can only be submitted for completed and delivered orders.',
            });
            return;
        }
        // Check duplicate review
        const existingReview = await Review_1.Review.findOne({ orderId: order._id });
        if (existingReview) {
            res.status(400).json({ success: false, message: 'A review has already been submitted for this order.' });
            return;
        }
        const review = await Review_1.Review.create({
            orderId: order._id,
            customerId: userId,
            customerName: req.user?.name || 'Happy Craver',
            rating: Number(rating),
            reviewText: reviewText.trim(),
            deliveryFeedback: deliveryFeedback ? deliveryFeedback.trim() : '',
        });
        res.status(201).json({ success: true, message: 'Thank you for your feedback!', review });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ success: false, message: 'You have already reviewed this order.' });
            return;
        }
        res.status(500).json({ success: false, message: 'Failed to submit review' });
    }
};
exports.createReview = createReview;
// Public: Get recent reviews
const getPublicReviews = async (req, res) => {
    try {
        const reviews = await Review_1.Review.find().sort({ createdAt: -1 }).limit(20);
        const avgAgg = await Review_1.Review.aggregate([
            { $group: { _id: null, avgRating: { $avg: '$rating' }, totalCount: { $sum: 1 } } },
        ]);
        res.json({
            success: true,
            averageRating: avgAgg[0]?.avgRating ? Number(avgAgg[0].avgRating.toFixed(1)) : 5.0,
            totalReviews: avgAgg[0]?.totalCount || 0,
            reviews,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
    }
};
exports.getPublicReviews = getPublicReviews;
