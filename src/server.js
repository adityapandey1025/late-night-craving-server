"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const constants_1 = require("./config/constants");
const db_1 = require("./config/db");
const socketService_1 = require("./services/socketService");
const seedService_1 = require("./services/seedService");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const reviewRoutes_1 = __importDefault(require("./routes/reviewRoutes"));
const adminController_1 = require("./controllers/adminController");
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
// Initialize Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((value) => value.trim()),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
});
exports.io = io;
(0, socketService_1.initSocketService)(io);
// Security & Middlewares
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
app.use((0, cors_1.default)({
    origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((value) => value.trim()),
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
// Rate Limiter
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', apiLimiter);
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        service: 'lateNightCraving Backend API',
    });
});
// Store status shortcut
app.get('/api/store/status', adminController_1.getStoreAvailability);
// API Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/products', productRoutes_1.default);
app.use('/api/orders', orderRoutes_1.default);
app.use('/api/payments', paymentRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/locations', locationRoutes_1.default);
app.use('/api/reviews', reviewRoutes_1.default);
// Root route for backend server
app.get('/', (req, res) => {
    res.json({
        service: 'lateNightCraving Backend API',
        status: 'online',
        port: Number(constants_1.CONFIG.PORT) || 5000,
        clientApp: constants_1.CONFIG.CLIENT_URL || 'http://localhost:5173',
        message: 'Backend REST API & Socket.IO server is running. Access the customer UI and Admin portal at http://localhost:5173',
        documentation: {
            health: '/api/health',
            storeStatus: '/api/store/status',
            products: '/api/products',
            categories: '/api/products/categories',
            locations: '/api/locations',
            reviews: '/api/reviews'
        }
    });
});
// Production only: Static client bundle serving (optional single-server deployment)
if (process.env.NODE_ENV === 'production' && process.env.SERVE_STATIC === 'true') {
    const clientDistPaths = [
        path_1.default.resolve(__dirname, '../../client/dist'),
        path_1.default.resolve(__dirname, '../client/dist'),
        path_1.default.resolve(process.cwd(), 'client/dist'),
    ];
    const clientDistPath = clientDistPaths.find((p) => fs_1.default.existsSync(p));
    if (clientDistPath) {
        console.log(`Serving static client bundle from: ${clientDistPath}`);
        app.use(express_1.default.static(clientDistPath));
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api')) {
                return next();
            }
            res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
        });
    }
}
// Global 404 handler for all other routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.method} ${req.originalUrl} not found on backend server.`,
        clientApp: 'http://localhost:5173',
        hint: 'If you are looking for the customer or admin web application, please open http://localhost:5173 in your browser.'
    });
});
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error occurred',
    });
});
// Start Server
async function start() {
    try {
        if (process.env.NODE_ENV === 'production') {
            const required = ['JWT_SECRET', 'ADMIN_ADITYA_PASSWORD', 'ADMIN_AMLESH_PASSWORD'];
            const missing = required.filter((key) => !process.env[key] || process.env[key].length < 16);
            if (missing.length) {
                throw new Error(`Production environment missing strong values (minimum 16 characters): ${missing.join(', ')}`);
            }
        }
        await (0, db_1.connectDB)();
        await (0, seedService_1.seedDatabase)();
        const PORT = Number(constants_1.CONFIG.PORT) || 5000;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 lateNightCraving API Server running on http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
if (process.env.NODE_ENV !== 'test') {
    start();
}
