const FeePayment = require('../entities/fee-payment.entity');
module.exports = { create: (data) => FeePayment.create(data), findByStudent: (student) => FeePayment.find({ student }).sort('-paidAt'), findByLibrary: (library) => FeePayment.find({ library }).sort('-paidAt'), findByStudents: (students) => FeePayment.find({ student: { $in: students } }).sort('-paidAt') };
