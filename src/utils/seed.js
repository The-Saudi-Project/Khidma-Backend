require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../modules/users/users.model');
const Service = require('../modules/services/services.model');

const services = [
  {
    name: 'Deep Home Cleaning',
    nameAr: 'تنظيف المنزل العميق',
    description: 'Comprehensive deep cleaning of your entire home. Our professional team uses premium eco-friendly products to clean every corner.',
    category: 'Cleaning',
    categoryAr: 'تنظيف',
    price: 250,
    priceType: 'fixed',
    duration: 180,
    features: ['All rooms cleaned', 'Kitchen deep clean', 'Bathroom sanitization', 'Window cleaning'],
    sortOrder: 1
  },
  {
    name: 'AC Maintenance & Service',
    nameAr: 'صيانة وخدمة التكييف',
    description: 'Full air conditioning maintenance including cleaning, gas check, and performance tuning by certified technicians.',
    category: 'AC & Appliances',
    categoryAr: 'تكييف وأجهزة',
    price: 180,
    priceType: 'fixed',
    duration: 90,
    features: ['Filter cleaning', 'Gas level check', 'Performance test', 'Coil cleaning'],
    sortOrder: 2
  },
  {
    name: 'Plumbing Repair',
    nameAr: 'إصلاح السباكة',
    description: 'Expert plumbing services for leaks, blockages, and installations. Available for emergency and scheduled visits.',
    category: 'Plumbing',
    categoryAr: 'سباكة',
    price: 120,
    priceType: 'starting_from',
    duration: 60,
    features: ['Leak repair', 'Pipe replacement', 'Drain unblocking', 'Fixture installation'],
    sortOrder: 3
  },
  {
    name: 'Electrical Work',
    nameAr: 'أعمال الكهرباء',
    description: 'Certified electricians for all residential electrical needs — from socket installation to full wiring.',
    category: 'Electrical',
    categoryAr: 'كهرباء',
    price: 150,
    priceType: 'starting_from',
    duration: 60,
    features: ['Socket installation', 'Circuit breaker', 'Light fittings', 'Safety inspection'],
    sortOrder: 4
  },
  {
    name: 'Painting Services',
    nameAr: 'خدمات الطلاء',
    description: 'Professional interior and exterior painting with premium quality paints. Get a fresh look for your home.',
    category: 'Painting',
    categoryAr: 'طلاء',
    price: 400,
    priceType: 'starting_from',
    duration: 480,
    features: ['Surface prep', 'Premium paints', 'Interior & exterior', 'Clean finish'],
    sortOrder: 5
  },
  {
    name: 'Pest Control',
    nameAr: 'مكافحة الحشرات',
    description: 'Effective pest control treatment for all types of insects and rodents using safe, certified chemicals.',
    category: 'Pest Control',
    categoryAr: 'مكافحة الآفات',
    price: 200,
    priceType: 'fixed',
    duration: 120,
    features: ['Full home treatment', 'Certified chemicals', 'Follow-up visit', 'Guarantee'],
    sortOrder: 6
  },
  {
    name: 'Furniture Assembly',
    nameAr: 'تركيب الأثاث',
    description: 'Professional assembly of all furniture types — IKEA, custom pieces, and office furniture.',
    category: 'Handyman',
    categoryAr: 'أعمال يدوية',
    price: 100,
    priceType: 'hourly',
    duration: 60,
    features: ['All furniture types', 'Tools provided', 'Disposal of packaging', 'IKEA specialists'],
    sortOrder: 7
  },
  {
    name: 'Home Deep Disinfection',
    nameAr: 'تعقيم المنزل العميق',
    description: 'Complete home disinfection and sanitization using hospital-grade products. Ideal for post-illness or seasonal hygiene.',
    category: 'Cleaning',
    categoryAr: 'تنظيف',
    price: 350,
    priceType: 'fixed',
    duration: 180,
    features: ['Hospital-grade products', 'Full coverage', 'Child & pet safe', 'Certificate issued'],
    sortOrder: 8
  }
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data (dev only)
    if (process.env.NODE_ENV !== 'production') {
      await User.deleteMany({ role: { $in: ['admin', 'provider'] } });
      await Service.deleteMany({});
      console.log('🗑️  Cleared existing seed data');
    }

    // Create admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@khidma.sa';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const admin = await User.create({
        name: process.env.ADMIN_NAME || 'Platform Admin',
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || 'Admin@123456',
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
        mustChangePassword: process.env.ADMIN_MUST_CHANGE_PASSWORD === 'true'
      });
      console.log(`✅ Admin created: ${admin.email}`);
    } else {
      console.log(`ℹ️  Admin already exists: ${adminEmail}`);
    }

    // Create sample providers
    const providers = [
      { name: 'Ahmed Al-Rashid', email: 'ahmed@khidma.sa', phone: '+966501234567', skills: ['Cleaning', 'Disinfection'] },
      { name: 'Mohammed Al-Zahrani', email: 'mohammed@khidma.sa', phone: '+966507654321', skills: ['AC & Appliances', 'Electrical'] },
      { name: 'Khalid Al-Otaibi', email: 'khalid@khidma.sa', phone: '+966509876543', skills: ['Plumbing', 'Handyman'] },
    ];

    for (const p of providers) {
      const exists = await User.findOne({ email: p.email });
      if (!exists) {
        await User.create({
          ...p,
          password: 'Provider@123456',
          role: 'provider',
          providerProfile: {
            skills: p.skills,
            isAvailable: true
          }
        });
        console.log(`✅ Provider created: ${p.email}`);
      }
    }

    // Create services
    const createdServices = await Service.insertMany(services);
    console.log(`✅ ${createdServices.length} services seeded`);

    console.log('\n🎉 Seed complete!');
    console.log(`   Admin: ${process.env.ADMIN_EMAIL || 'admin@khidma.sa'}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@123456'}`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
};

seed();
