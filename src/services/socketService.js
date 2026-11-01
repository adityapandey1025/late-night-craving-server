"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketEvents = void 0;
exports.initSocketService = initSocketService;
exports.getIO = getIO;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const constants_1 = require("../config/constants");
let ioInstance = null;
function initSocketService(io) {
    ioInstance = io;
    // Socket middleware for authentication if token provided
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, constants_1.CONFIG.JWT_SECRET);
                socket.data.user = decoded;
            }
            catch (err) {
                // Allow unauthenticated guest connections for public store updates
            }
        }
        next();
    });
    io.on('connection', (socket) => {
        const user = socket.data.user;
        // If user is admin, join admins room
        if (user?.role === 'admin') {
            socket.join('admins');
        }
        else if (user?.id) {
            // Customer personal notification room
            socket.join(`user:${user.id}`);
        }
        // Join order room if authorized
        socket.on('join_order', ({ orderId }) => {
            if (orderId) {
                socket.join(`order:${orderId}`);
            }
        });
        socket.on('leave_order', ({ orderId }) => {
            if (orderId) {
                socket.leave(`order:${orderId}`);
            }
        });
        socket.on('disconnect', () => {
            // cleanup on disconnect
        });
    });
}
function getIO() {
    if (!ioInstance) {
        throw new Error('Socket.IO is not initialized yet');
    }
    return ioInstance;
}
// Socket emission helpers
exports.socketEvents = {
    notifyNewOrder: (order) => {
        if (!ioInstance)
            return;
        ioInstance.to('admins').emit('order:new', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            order,
        });
    },
    notifyOrderStatusUpdate: (orderId, payload) => {
        if (!ioInstance)
            return;
        ioInstance.to(`order:${orderId}`).emit('order:status_updated', payload);
        ioInstance.to('admins').emit('order:status_updated', payload);
    },
    notifyOrderETA: (orderId, eta) => {
        if (!ioInstance)
            return;
        ioInstance.to(`order:${orderId}`).emit('order:eta_updated', eta);
    },
    notifyAdminAvailability: (payload) => {
        if (!ioInstance)
            return;
        ioInstance.emit('store:availability_updated', payload);
    },
    notifyPaymentConfirmed: (orderId, payload) => {
        if (!ioInstance)
            return;
        ioInstance.to(`order:${orderId}`).emit('order:payment_confirmed', payload);
        ioInstance.to('admins').emit('order:payment_confirmed', payload);
    },
};
