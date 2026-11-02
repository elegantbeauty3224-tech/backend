const SalesReport = require('../models/SalesReport');
const Order = require('../models/Order');
const connectDB = require('../config/db');

// Month Names in Bengali and English
const MONTH_NAMES_BN = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

// Helper: Synchronize delivered orders into SalesReport
async function syncDeliveredOrders() {
  try {
    const deliveredOrders = await Order.find({
      orderStatus: { $regex: /delivered/i },
    }).lean();

    for (const ord of deliveredOrders) {
      const rawDate = ord.updatedAt || ord.createdAt || new Date();
      const dDate = new Date(rawDate);
      const safeDate = isNaN(dDate.getTime()) ? new Date() : dDate;
      const month = safeDate.getMonth() + 1;
      const year = safeDate.getFullYear();
      const monthYear = `${year}-${String(month).padStart(2, '0')}`;

      const rawItems = ord.items && ord.items.length > 0 ? ord.items : [];
      const items =
        rawItems.length > 0
          ? rawItems.map((it) => ({
              productId: it.product,
              productTitle: it.productTitle || 'Unknown Product',
              variantName: it.variantName || 'Default',
              colorCode: it.colorCode || '',
              size: it.size || '',
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice: Number(it.totalPrice) || (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
              image: it.image || '/banner.jpeg',
            }))
          : [
              {
                productId: 'order-item',
                productTitle: 'ডেলিভারড পণ্য',
                variantName: 'Default',
                colorCode: '',
                size: '',
                quantity: 1,
                unitPrice: Number(ord.subtotal) || Number(ord.totalAmount) || 0,
                totalPrice: Number(ord.subtotal) || Number(ord.totalAmount) || 0,
                image: '/banner.jpeg',
              },
            ];

      await SalesReport.findOneAndUpdate(
        { orderNumber: ord.orderNumber },
        {
          orderId: ord._id,
          orderNumber: ord.orderNumber,
          customerName: ord.customerName || 'Customer',
          customerPhone: ord.phoneNumber || '',
          deliveryAddress: ord.deliveryAddress || '',
          deliveryArea: ord.deliveryArea || 'inside_dhaka',
          deliveryFee: Number(ord.deliveryFee) || 0,
          subtotal: Number(ord.subtotal) || Number(ord.totalAmount) || 0,
          totalAmount: Number(ord.totalAmount) || (Number(ord.subtotal) || 0) + (Number(ord.deliveryFee) || 0),
          paymentMethod: ord.paymentMethod || 'Cash on Delivery (COD)',
          deliveredAt: safeDate,
          items,
          month,
          year,
          monthYear,
          isDeleted: false,
        },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.warn('Sales report auto-sync warning:', err.message);
  }
}

// @desc    Get Sales Reports (Monthly or Yearly)
// @route   GET /api/sales-reports
exports.getSalesReports = async (req, res) => {
  try {
    await connectDB();
    await syncDeliveredOrders();

    const period = req.query.period || 'all'; // 'all' | 'monthly' | 'yearly'
    const now = new Date();
    const queryYear = Number(req.query.year) || now.getFullYear();
    const queryMonth = Number(req.query.month) || now.getMonth() + 1;

    const filter = { isDeleted: { $ne: true } };

    if (period === 'monthly') {
      filter.year = queryYear;
      filter.month = queryMonth;
    } else if (period === 'yearly') {
      filter.year = queryYear;
    }

    const reports = await SalesReport.find(filter).sort({ deliveredAt: -1 }).lean();

    // Calculate Summary Metrics
    let totalDeliveredOrders = reports.length;
    let totalItemsSold = 0;
    let totalRevenue = 0;
    let totalDeliveryFees = 0;
    let netProductSales = 0;

    const productSalesMap = {};

    reports.forEach((rep) => {
      totalRevenue += Number(rep.totalAmount) || 0;
      totalDeliveryFees += Number(rep.deliveryFee) || 0;
      netProductSales += Number(rep.subtotal) || 0;

      (rep.items || []).forEach((item) => {
        const qty = Number(item.quantity) || 1;
        totalItemsSold += qty;

        const prodKey = `${item.productTitle}___${item.variantName || 'Default'}`;
        if (!productSalesMap[prodKey]) {
          productSalesMap[prodKey] = {
            productTitle: item.productTitle,
            variantName: item.variantName || 'Default',
            colorCode: item.colorCode || '',
            size: item.size || '',
            image: item.image || '/banner.jpeg',
            totalQuantity: 0,
            totalSales: 0,
          };
        }
        productSalesMap[prodKey].totalQuantity += qty;
        productSalesMap[prodKey].totalSales += Number(item.totalPrice) || (Number(item.unitPrice) || 0) * qty;
      });
    });

    const topProducts = Object.values(productSalesMap).sort((a, b) => b.totalQuantity - a.totalQuantity);

    // Available Years for filter dropdown
    const distinctYears = await SalesReport.distinct('year', { isDeleted: { $ne: true } });
    const availableYears = Array.from(new Set([queryYear, now.getFullYear(), ...distinctYears])).sort(
      (a, b) => b - a
    );

    // Month Counts for the current year
    const monthlyStats = await SalesReport.aggregate([
      { $match: { year: queryYear, isDeleted: { $ne: true } } },
      { $group: { _id: '$month', count: { $sum: 1 }, totalRevenue: { $sum: '$totalAmount' } } },
    ]);

    const monthsData = Array.from({ length: 12 }, (_, i) => {
      const mNum = i + 1;
      const found = monthlyStats.find((s) => s._id === mNum);
      return {
        month: mNum,
        nameBn: MONTH_NAMES_BN[i],
        orderCount: found ? found.count : 0,
        revenue: found ? found.totalRevenue : 0,
      };
    });

    let periodLabel = 'সকল সময় (All Time)';
    if (period === 'monthly') {
      periodLabel = `${MONTH_NAMES_BN[queryMonth - 1]} ${queryYear}`;
    } else if (period === 'yearly') {
      periodLabel = `${queryYear} সাল (বার্ষিক)`;
    }

    return res.status(200).json({
      success: true,
      data: {
        reports,
        summary: {
          totalDeliveredOrders,
          totalItemsSold,
          totalRevenue,
          totalDeliveryFees,
          netProductSales,
          periodLabel,
          period,
          year: queryYear,
          month: queryMonth,
        },
        topProducts,
        availableYears,
        monthsData,
      },
    });
  } catch (error) {
    console.error('getSalesReports error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete single sales report entry
// @route   DELETE /api/sales-reports/:id
exports.deleteSalesReport = async (req, res) => {
  try {
    const { id } = req.params;
    await connectDB();

    const deleted = await SalesReport.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'সেলস রিপোর্ট পাওয়া যায়নি।' });
    }

    return res.status(200).json({
      success: true,
      message: 'সেলস রিপোর্ট সফলভাবে মুছে ফেলা হয়েছে।',
    });
  } catch (error) {
    console.error('deleteSalesReport error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear / Delete sales reports for an entire month or year
// @route   POST /api/sales-reports/clear
exports.clearSalesReports = async (req, res) => {
  try {
    const { period, year, month } = req.body;
    await connectDB();

    const filter = {};
    if (period === 'monthly') {
      if (!year || !month) {
        return res.status(400).json({ success: false, message: 'বছর ও মাস প্রদান করুন।' });
      }
      filter.year = Number(year);
      filter.month = Number(month);
    } else if (period === 'yearly') {
      if (!year) {
        return res.status(400).json({ success: false, message: 'বছর প্রদান করুন।' });
      }
      filter.year = Number(year);
    } else {
      return res.status(400).json({ success: false, message: 'সঠিক পিরিয়ড নির্বাচন করুন।' });
    }

    const result = await SalesReport.deleteMany(filter);

    return res.status(200).json({
      success: true,
      message: `সফলভাবে ${result.deletedCount} টি সেলস রিপোর্ট রেকর্ড মুছে ফেলা হয়েছে।`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('clearSalesReports error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Manual Trigger Sync
// @route   POST /api/sales-reports/sync
exports.manualSync = async (req, res) => {
  try {
    await connectDB();
    await syncDeliveredOrders();
    return res.status(200).json({ success: true, message: 'সেলস রিপোর্ট সফলভাবে সিঙ্ক হয়েছে।' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

