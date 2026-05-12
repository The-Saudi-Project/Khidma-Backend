const mongoose = require('mongoose');
require('dotenv').config();
const Service = require('../modules/services/services.model');
const connectDB = require('../config/database');

const services = [
  // --- RESIDENTIAL SECTOR ---
  // Maintenance & Repair
  {
    name: 'Electrical Maintenance & Wiring',
    nameAr: 'صيانة الكهرباء والأسلاك',
    category: 'Maintenance & Repair',
    sector: 'residential',
    description: 'Expert repair of switches, wiring, lights, and fans. Comprehensive electrical safety audits for Dammam homes.',
    price: 120,
    priceType: 'hourly',
    duration: 60,
    image: '/uploads/services/electrical.png',
    features: ['Switch Replacement', 'Circuit Troubleshooting', 'LED Installation', 'Safety Audit'],
    sortOrder: 1
  },
  {
    name: 'AC Full Service & Gas Refill',
    nameAr: 'خدمة التكييف كاملة وتعبئة الغاز',
    category: 'Maintenance & Repair',
    sector: 'residential',
    description: 'Installation, cleaning, and gas refill for all types of AC units. Essential for Saudi summer comfort.',
    price: 250,
    priceType: 'starting_from',
    duration: 90,
    image: '/uploads/services/ac.png',
    features: ['Filter Cleaning', 'Gas Pressure Check', 'Drainage Clearing', 'Unit Sanitization'],
    sortOrder: 2
  },
  // Cleaning Services
  {
    name: 'Home Deep Cleaning',
    nameAr: 'تنظيف المنزل العميق',
    category: 'Cleaning Services',
    sector: 'residential',
    description: 'Specialized deep cleaning for kitchens and bathrooms. Removal of stubborn stains and full sanitization.',
    price: 350,
    priceType: 'fixed',
    duration: 240,
    image: '/uploads/services/cleaning.png',
    features: ['Kitchen Degreasing', 'Bathroom Descaling', 'Window Tracks', 'Surface Disinfection'],
    sortOrder: 3
  },
  {
    name: 'Sofa & Carpet Shampooing',
    nameAr: 'غسيل الكنب والسجاد بالشامبو',
    category: 'Cleaning Services',
    sector: 'residential',
    description: 'Professional shampoo cleaning for sofas, carpets, and mattresses. Kills allergens and restores fabric.',
    price: 180,
    priceType: 'starting_from',
    duration: 120,
    image: '/uploads/services/cleaning.png',
    features: ['Steam Extraction', 'Stain Pre-treatment', 'Fabric Refreshing', 'Odor Removal'],
    sortOrder: 4
  },
  // Handyman
  {
    name: 'Drilling & Wall Hanging',
    nameAr: 'الثقب والتعليق على الجدران',
    category: 'Handyman / Odd Jobs',
    sector: 'residential',
    description: 'Professional drilling for paintings, TVs, curtain rods, and shelves. Clean and precise work.',
    price: 80,
    priceType: 'hourly',
    duration: 60,
    image: '/uploads/services/plumbing.png', // Fallback
    features: ['TV Wall Mounting', 'Curtain Rod Fixing', 'Mirror Hanging', 'Shelf Installation'],
    sortOrder: 5
  },
  // Moving
  {
    name: 'Home Shifting (Pack & Move)',
    nameAr: 'نقل المنزل (تعبئة ونقل)',
    category: 'Moving & Support',
    sector: 'residential',
    description: 'End-to-end relocation service including packing, transport, and furniture reassembly in Dammam.',
    price: 1500,
    priceType: 'starting_from',
    duration: 480,
    image: '/uploads/services/moving.png',
    features: ['Professional Packing', 'Secure Transport', 'Furniture Assembly', 'Fragile Item Care'],
    sortOrder: 6
  },

  // --- INDUSTRIAL SECTOR ---
  {
    name: 'Industrial HVAC Maintenance',
    nameAr: 'صيانة التكييف الصناعي',
    category: 'Technical & Maintenance',
    sector: 'industrial',
    description: 'Maintenance for chillers, AHUs, and complex duct systems in industrial facilities.',
    price: 2000,
    priceType: 'starting_from',
    duration: 360,
    image: '/uploads/services/industrial.png',
    features: ['Chiller Servicing', 'Duct Cleaning', 'IAQ Monitoring', 'Predictive Maintenance'],
    sortOrder: 10
  },
  {
    name: 'Industrial Floor Cleaning',
    nameAr: 'تنظيف الأرضيات الصناعية',
    category: 'Cleaning & Housekeeping',
    sector: 'industrial',
    description: 'Heavy-duty machine cleaning for warehouse floors, including oil and grease removal.',
    price: 1200,
    priceType: 'fixed',
    duration: 300,
    image: '/uploads/services/industrial.png',
    features: ['Oil Degreasing', 'Scrubber Drying', 'Warehouse Sanitation', 'Machine Area Cleaning'],
    sortOrder: 11
  },

  // --- CORPORATE SECTOR ---
  {
    name: 'Daily Office Housekeeping',
    nameAr: 'التدبير المنزلي اليومي للمكتب',
    category: 'Housekeeping & Hygiene',
    sector: 'commercial',
    description: 'Daily janitorial services for corporate buildings, restrooms, and workstations.',
    price: 2500,
    priceType: 'starting_from', // Monthly contract base
    duration: 480,
    image: '/uploads/services/corporate.png',
    features: ['Workstation Sanitization', 'Pantry Maintenance', 'Restroom Hygiene', 'Glass Cleaning'],
    sortOrder: 20
  },
  {
    name: 'IT & Security AMC',
    nameAr: 'عقد صيانة سنوي لتقنية المعلومات والأمن',
    category: 'Security & IT Systems',
    sector: 'commercial',
    description: 'Annual Maintenance Contract for CCTV, access control, and biometric systems.',
    price: 3000,
    priceType: 'starting_from',
    duration: 1440, // Year-round support
    image: '/uploads/services/corporate.png',
    features: ['CCTV Maintenance', 'Biometric Sync', 'Access Control Audit', 'PA System Check'],
    sortOrder: 21
  },

  // --- RETAIL/MALL SECTOR ---
  {
    name: '24/7 Mall Integrated FM',
    nameAr: 'إدارة المرافق المتكاملة للمول 24/7',
    category: 'Integrated Facilities Management',
    sector: 'commercial',
    description: 'Premium on-site technical support for malls, covering electrical, plumbing, and HVAC.',
    price: 15000,
    priceType: 'starting_from', // Monthly
    duration: 43200, // Ongoing
    image: '/uploads/services/retail.png',
    features: ['On-site Technical Team', 'BMS Coordination', 'Energy Management', 'Escalator Support'],
    sortOrder: 30
  },
  {
    name: 'Mall Night Deep-Clean',
    nameAr: 'تنظيف عميق ليلي للمول',
    category: 'Cleaning & Hygiene',
    sector: 'commercial',
    description: 'Intensive overnight cleaning of common areas, food courts, and washrooms.',
    price: 5000,
    priceType: 'starting_from',
    duration: 600,
    image: '/uploads/services/retail.png',
    features: ['Food Court Sanitation', 'Marble Polishing', 'Washroom Deep Clean', 'External Area Cleaning'],
    sortOrder: 31
  }
];

const seedDB = async () => {
  try {
    await connectDB();
    console.log('Connected to DB...');

    await Service.deleteMany({});
    console.log('Old services removed.');

    await Service.insertMany(services);
    console.log(`${services.length} Comprehensive services seeded successfully!`);

    process.exit();
  } catch (err) {
    console.error('Error seeding services:', err);
    process.exit(1);
  }
};

seedDB();
