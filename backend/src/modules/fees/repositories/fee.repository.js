import FeePayment from '../entities/fee-payment.entity.js';
export default {
  create: (data) => FeePayment.create(data),
  findByStudent: (student) => FeePayment.find({ student }).sort("-paidAt"),
  findByLibrary: (library) => FeePayment.find({ library }).sort("-paidAt"),
  findByStudents: (students) =>
    FeePayment.find({ student: { $in: students } }).sort("-paidAt"),
};
