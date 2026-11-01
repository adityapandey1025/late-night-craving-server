"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const Admin_1 = require("../models/Admin");
const Category_1 = require("../models/Category");
const Product_1 = require("../models/Product");
const DeliveryLocation_1 = require("../models/DeliveryLocation");
const BusinessSettings_1 = require("../models/BusinessSettings");
const constants_1 = require("../config/constants");
async function seedDatabase() {
    try {
        console.log('Checking database seed status...');
        // 1. Seed Admins (Aditya & Amlesh)
        for (const seed of constants_1.CONFIG.ADMIN_SEEDS) {
            const existing = await Admin_1.Admin.findOne({ email: seed.email });
            if (!existing) {
                const hashedPassword = await bcryptjs_1.default.hash(seed.password, 10);
                await Admin_1.Admin.create({
                    name: seed.name,
                    email: seed.email,
                    phone: seed.phone,
                    password: hashedPassword,
                    upiId: seed.upiId,
                    upiName: seed.upiName,
                    availabilityStatus: 'OPEN',
                    isActive: true,
                });
                console.log(`Seeded Admin account: ${seed.name} (${seed.email})`);
            }
        }
        // 2. Seed Business Settings
        const existingSettings = await BusinessSettings_1.BusinessSettings.findOne();
        if (!existingSettings) {
            await BusinessSettings_1.BusinessSettings.create({
                businessName: 'lateNightCraving',
                tagline: 'Your late-night cravings, delivered.',
                supportPhone: '+91 98765 43210',
                whatsappNumber: '919876543210',
                deliveryFeeBrackets: [
                    { maxSubtotalPaise: 9900, feePaise: 3000 },
                    { maxSubtotalPaise: 15000, feePaise: 4000 },
                    { maxSubtotalPaise: 30000, feePaise: 6000 },
                    { maxSubtotalPaise: 99999999, feePaise: 6000 },
                ],
            });
            console.log('Seeded BusinessSettings');
        }
        // 3. Seed Delivery Locations
        const locationCount = await DeliveryLocation_1.DeliveryLocation.countDocuments();
        let defaultLocations = [];
        if (locationCount === 0) {
            defaultLocations = await DeliveryLocation_1.DeliveryLocation.insertMany([
                {
                    name: 'North Campus & Hostels',
                    description: 'Hostel Blocks 1-8, North Mess, Library Quad',
                    estimatedDeliveryMinutes: 20,
                    isActive: true,
                    displayOrder: 1,
                },
                {
                    name: 'South Campus & PG Enclave',
                    description: 'South Gate, PG Clusters 1-4, University Road',
                    estimatedDeliveryMinutes: 25,
                    isActive: true,
                    displayOrder: 2,
                },
                {
                    name: 'Sector 14 Residential & Societies',
                    description: 'Silver Oaks, Palm Heights, Main Gate Security',
                    estimatedDeliveryMinutes: 30,
                    isActive: true,
                    displayOrder: 3,
                },
                {
                    name: 'Tech City & Co-Living Spaces',
                    description: 'Stanza Living, Oxford CoLive, Cyber Tower Area',
                    estimatedDeliveryMinutes: 35,
                    isActive: true,
                    displayOrder: 4,
                },
            ]);
            console.log('Seeded Delivery Locations');
        }
        // 4. Seed Categories
        const categoryCount = await Category_1.Category.countDocuments();
        if (categoryCount === 0) {
            const categories = await Category_1.Category.insertMany([
                {
                    name: 'Burgers & Wraps',
                    slug: 'burgers-and-wraps',
                    description: 'Juicy, sizzling burgers and loaded toasted wraps for late night munchies.',
                    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
                    displayOrder: 1,
                    isActive: true,
                },
                {
                    name: 'Midnight Maggi & Bites',
                    slug: 'maggi-and-bites',
                    description: 'Cheesy peri-peri maggi, loaded fries, crispy nuggets and quick cravings.',
                    imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
                    displayOrder: 2,
                    isActive: true,
                },
                {
                    name: 'Pizzas & Garlic Breads',
                    slug: 'pizzas',
                    description: 'Freshly baked thin-crust cheese bursts and stuffed garlic sticks.',
                    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
                    displayOrder: 3,
                    isActive: true,
                },
                {
                    name: 'Cold Beverages & Shakes',
                    slug: 'beverages-shakes',
                    description: 'Thick Belgian chocolate shakes, iced coffees, Red Bull and chilled sodas.',
                    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
                    displayOrder: 4,
                    isActive: true,
                },
                {
                    name: 'Packaged Snacks & Essentials',
                    slug: 'packaged-essentials',
                    description: 'Chips, Kurkure, Chocolates, energy bars, and late-night study essentials.',
                    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281729?auto=format&fit=crop&w=600&q=80',
                    displayOrder: 5,
                    isActive: true,
                },
                {
                    name: 'Desserts & Ice Creams',
                    slug: 'desserts-ice-creams',
                    description: 'Warm fudge brownies, gourmet waffle bites, and tub ice creams.',
                    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
                    displayOrder: 6,
                    isActive: true,
                },
                {
                    name: 'Unknown',
                    slug: 'unknown',
                    description: 'Products without a specific category.',
                    imageUrl: '',
                    displayOrder: 7,
                    isActive: true,
                },
            ]);
            console.log('Seeded Categories');
            // 5. Seed Products with various payment policies & types
            const burgerCat = categories[0]._id;
            const maggiCat = categories[1]._id;
            const pizzaCat = categories[2]._id;
            const bevCat = categories[3]._id;
            const packCat = categories[4]._id;
            const dessertCat = categories[5]._id;
            await Product_1.Product.insertMany([
                // Fast-Food items with PARTIAL_PAYMENT (40% advance)
                {
                    name: 'Smoky BBQ Double Patty Burger',
                    slug: 'smoky-bbq-double-patty-burger',
                    description: 'Two grilled patties with molten cheddar cheese, caramelised onions, and tangy BBQ sauce.',
                    images: ['https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80'],
                    categoryId: burgerCat,
                    productType: 'FAST_FOOD',
                    sellingPrice: 16900, // ₹169.00
                    originalPrice: 19900,
                    availability: true,
                    inventory: 30,
                    isFeatured: true,
                    paymentPolicy: 'PARTIAL_PAYMENT',
                    partialPaymentPercentage: 40,
                },
                {
                    name: 'Crispy Paneer Makhani Wrap',
                    slug: 'crispy-paneer-makhani-wrap',
                    description: 'Toasted tortilla filled with spiced paneer, rich makhani gravy, mint mayo and fresh onion rings.',
                    images: ['https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80'],
                    categoryId: burgerCat,
                    productType: 'FAST_FOOD',
                    sellingPrice: 13900, // ₹139.00
                    originalPrice: 16900,
                    availability: true,
                    inventory: 25,
                    isFeatured: false,
                    paymentPolicy: 'PARTIAL_PAYMENT',
                    partialPaymentPercentage: 40,
                },
                {
                    name: 'Double Masala Cheese Burst Maggi',
                    slug: 'double-masala-cheese-burst-maggi',
                    description: 'The iconic late-night hostel staple loaded with extra secret masala, butter, and melted mozzarella.',
                    images: ['https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80'],
                    categoryId: maggiCat,
                    productType: 'FAST_FOOD',
                    sellingPrice: 8900, // ₹89.00
                    originalPrice: 10900,
                    availability: true,
                    inventory: 50,
                    isFeatured: true,
                    paymentPolicy: 'PARTIAL_PAYMENT',
                    partialPaymentPercentage: 40,
                },
                {
                    name: 'Peri-Peri Crinkle Fries (Large)',
                    slug: 'peri-peri-crinkle-fries-large',
                    description: 'Golden crinkle cut french fries tossed in fiery African peri-peri seasoning with garlic dip.',
                    images: ['https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80'],
                    categoryId: maggiCat,
                    productType: 'FAST_FOOD',
                    sellingPrice: 10900, // ₹109.00
                    originalPrice: 12900,
                    availability: true,
                    inventory: 40,
                    isFeatured: false,
                    paymentPolicy: 'PARTIAL_PAYMENT',
                    partialPaymentPercentage: 40,
                },
                {
                    name: '8" Midnight Pepperoni & Jalapeno Pizza',
                    slug: '8-midnight-pepperoni-jalapeno-pizza',
                    description: 'Freshly stretched crust with herb tomato sauce, spicy sliced pepperoni, and zesty pickled jalapenos.',
                    images: ['https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80'],
                    categoryId: pizzaCat,
                    productType: 'FAST_FOOD',
                    sellingPrice: 24900, // ₹249.00
                    originalPrice: 28900,
                    availability: true,
                    inventory: 20,
                    isFeatured: true,
                    paymentPolicy: 'FULL_PAYMENT', // 100% advance demo
                    partialPaymentPercentage: 100,
                },
                {
                    name: 'Stuffed Cheesy Garlic Breadsticks',
                    slug: 'stuffed-cheesy-garlic-breadsticks',
                    description: 'Freshly baked breadsticks stuffed with sweet corn, jalapenos and creamy garlic butter cheese.',
                    images: ['https://images.unsplash.com/photo-1619881589775-84cb639e31d5?auto=format&fit=crop&w=600&q=80'],
                    categoryId: pizzaCat,
                    productType: 'FAST_FOOD',
                    sellingPrice: 14900, // ₹149.00
                    originalPrice: 17900,
                    availability: true,
                    inventory: 25,
                    isFeatured: false,
                    paymentPolicy: 'PARTIAL_PAYMENT',
                    partialPaymentPercentage: 40,
                },
                // Packaged & Drinks items (some NO_ONLINE_PAYMENT, some PARTIAL_PAYMENT)
                {
                    name: 'Belgian Dark Chocolate Thick Shake',
                    slug: 'belgian-dark-chocolate-thick-shake',
                    description: 'Ultra rich and creamy shake blended with authentic 70% dark Belgian cocoa and chocolate chips.',
                    images: ['https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80'],
                    categoryId: bevCat,
                    productType: 'PACKAGED',
                    sellingPrice: 12900, // ₹129.00
                    originalPrice: 14900,
                    availability: true,
                    inventory: 35,
                    isFeatured: true,
                    paymentPolicy: 'PARTIAL_PAYMENT',
                    partialPaymentPercentage: 40,
                },
                {
                    name: 'Red Bull Energy Drink (250ml Can)',
                    slug: 'red-bull-energy-drink-250ml',
                    description: 'Vitalizes body and mind for your late-night study and coding sessions.',
                    images: ['https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80'],
                    categoryId: bevCat,
                    productType: 'PACKAGED',
                    sellingPrice: 12500, // ₹125.00
                    originalPrice: 12500,
                    availability: true,
                    inventory: 60,
                    isFeatured: false,
                    paymentPolicy: 'NO_ONLINE_PAYMENT', // 0% advance (Pay on delivery)
                    partialPaymentPercentage: 0,
                },
                {
                    name: "Lay's Gourmet Vintage Cheese & Paprika (50g)",
                    slug: 'lays-gourmet-vintage-cheese-50g',
                    description: 'Slow-cooked kettle chips made with select potatoes and sharp vintage cheddar flavour.',
                    images: ['https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80'],
                    categoryId: packCat,
                    productType: 'PACKAGED',
                    sellingPrice: 5000, // ₹50.00
                    originalPrice: 5000,
                    availability: true,
                    inventory: 100,
                    isFeatured: false,
                    paymentPolicy: 'NO_ONLINE_PAYMENT', // Pay on delivery
                    partialPaymentPercentage: 0,
                },
                {
                    name: 'Cadbury Dairy Milk Silk Roasted Almond (143g)',
                    slug: 'cadbury-silk-roasted-almond-143g',
                    description: 'Smooth, melting chocolate packed with crunchy whole roasted Californian almonds.',
                    images: ['https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80'],
                    categoryId: packCat,
                    productType: 'PACKAGED',
                    sellingPrice: 18500, // ₹185.00
                    originalPrice: 19500,
                    availability: true,
                    inventory: 40,
                    isFeatured: false,
                    paymentPolicy: 'PARTIAL_PAYMENT',
                    partialPaymentPercentage: 40,
                },
                {
                    name: 'Warm Sizzling Walnut Brownie with Hot Fudge',
                    slug: 'warm-sizzling-walnut-brownie',
                    description: 'Dense dark chocolate brownie infused with crunchy walnuts and drizzled with molten chocolate.',
                    images: ['https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80'],
                    categoryId: dessertCat,
                    productType: 'FAST_FOOD',
                    sellingPrice: 11900, // ₹119.00
                    originalPrice: 13900,
                    availability: true,
                    inventory: 20,
                    isFeatured: true,
                    paymentPolicy: 'PARTIAL_PAYMENT',
                    partialPaymentPercentage: 40,
                },
            ]);
            console.log('Seeded Products with mixed payment policies');
        }
        console.log('Seed check complete!');
    }
    catch (error) {
        console.error('Error seeding database:', error);
    }
}
