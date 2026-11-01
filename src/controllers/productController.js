"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategory = exports.deleteProduct = exports.toggleProductAvailability = exports.updateProduct = exports.createProduct = exports.getCategories = exports.getProductById = exports.getProducts = void 0;
const Product_1 = require("../models/Product");
const Category_1 = require("../models/Category");
// Helper to create slug
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
};
// Public: Get all active products
const getProducts = async (req, res) => {
    try {
        const { category, type, search, featured, availability } = req.query;
        const query = { isActive: true };
        if (category) {
            const cat = await Category_1.Category.findOne({
                $or: [{ _id: category }, { slug: category }],
            });
            if (cat) {
                query.categoryId = cat._id;
            }
        }
        if (type && (type === 'PACKAGED' || type === 'FAST_FOOD')) {
            query.productType = type;
        }
        if (featured === 'true') {
            query.isFeatured = true;
        }
        if (availability === 'true') {
            query.availability = true;
        }
        if (search && typeof search === 'string') {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }
        const products = await Product_1.Product.find(query)
            .populate('categoryId', 'name slug')
            .sort({ isFeatured: -1, createdAt: -1 });
        res.json({
            success: true,
            count: products.length,
            products,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
};
exports.getProducts = getProducts;
// Public: Get single product by ID or Slug
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        let product;
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            product = await Product_1.Product.findById(id).populate('categoryId', 'name slug');
        }
        else {
            product = await Product_1.Product.findOne({ slug: id, isActive: true }).populate('categoryId', 'name slug');
        }
        if (!product || !product.isActive) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }
        res.json({ success: true, product });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve product details' });
    }
};
exports.getProductById = getProductById;
// Public: Get all active categories
const getCategories = async (req, res) => {
    try {
        const categories = await Category_1.Category.find({ isActive: true }).sort({ displayOrder: 1 });
        res.json({ success: true, categories });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
};
exports.getCategories = getCategories;
// Admin: Create product
const createProduct = async (req, res) => {
    try {
        const { name, description, images, categoryId, productType, sellingPrice, originalPrice, availability, inventory, isFeatured, paymentPolicy, partialPaymentPercentage, } = req.body;
        if (!name || !categoryId || !productType || sellingPrice === undefined) {
            res.status(400).json({ success: false, message: 'Missing required product fields' });
            return;
        }
        const slug = `${slugify(name)}-${Date.now().toString().slice(-4)}`;
        const product = await Product_1.Product.create({
            name,
            slug,
            description: description || '',
            images: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'],
            categoryId,
            productType,
            sellingPrice: Math.round(Number(sellingPrice)), // ensure integer paise
            originalPrice: originalPrice ? Math.round(Number(originalPrice)) : undefined,
            availability: availability !== undefined ? Boolean(availability) : true,
            inventory: inventory !== undefined && inventory !== '' ? Number(inventory) : null,
            isFeatured: Boolean(isFeatured),
            paymentPolicy: paymentPolicy || 'PARTIAL_PAYMENT',
            partialPaymentPercentage: partialPaymentPercentage !== undefined ? Number(partialPaymentPercentage) : 40,
            isActive: true,
        });
        res.status(201).json({ success: true, message: 'Product created successfully', product });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Failed to create product' });
    }
};
exports.createProduct = createProduct;
// Admin: Update product
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };
        if (updates.sellingPrice !== undefined) {
            updates.sellingPrice = Math.round(Number(updates.sellingPrice));
        }
        if (updates.originalPrice !== undefined) {
            updates.originalPrice = updates.originalPrice ? Math.round(Number(updates.originalPrice)) : undefined;
        }
        const product = await Product_1.Product.findByIdAndUpdate(id, updates, { new: true });
        if (!product) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }
        res.json({ success: true, message: 'Product updated successfully', product });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update product' });
    }
};
exports.updateProduct = updateProduct;
// Admin: Toggle availability
const toggleProductAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product_1.Product.findById(id);
        if (!product) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }
        product.availability = !product.availability;
        await product.save();
        res.json({
            success: true,
            message: `Product marked as ${product.availability ? 'Available' : 'Unavailable'}`,
            availability: product.availability,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle availability' });
    }
};
exports.toggleProductAvailability = toggleProductAvailability;
// Admin: Delete (soft delete) product
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product_1.Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!product) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }
        res.json({ success: true, message: 'Product removed successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
};
exports.deleteProduct = deleteProduct;
// Admin: Create Category
const createCategory = async (req, res) => {
    try {
        const { name, description, imageUrl, displayOrder } = req.body;
        if (!name) {
            res.status(400).json({ success: false, message: 'Category name is required' });
            return;
        }
        const slug = slugify(name);
        const category = await Category_1.Category.create({
            name,
            slug,
            description: description || '',
            imageUrl: imageUrl || '',
            displayOrder: displayOrder || 0,
            isActive: true,
        });
        res.status(201).json({ success: true, message: 'Category created', category });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Failed to create category' });
    }
};
exports.createCategory = createCategory;
