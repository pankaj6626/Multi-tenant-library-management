const express = require('express');
const Library = require('../models/Library');
const Librarian = require('../models/Librarian');
const Student = require('../models/Student');
const Seat = require('../models/Seat');
const FeePayment = require('../models/FeePayment');
const Concern = require('../models/Concern');
const { hashPassword, verifyPassword, signToken } = require('../utils/security');
const { protect, allow } = require('../middleware/auth');

const router = express.Router();
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const monthAgo = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const tokenFor = (user, role, libraryCode) => signToken({ id: user._id?.toString() || 'admin', role, libraryId: user.library?.toString(), libraryCode });

const libraryFor = async (code) => {
  const library = await Library.findOne({ libraryCode: code, status: 'APPROVED' });
  if (!library) throw Object.assign(new Error('Approved library not found for this libraryCode'), { status: 404 });
  return library;
};

router.post('/auth/login', asyncRoute(async (req, res) => {
  const { email, password, libraryCode } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) return res.json({ token: tokenFor({}, 'ADMIN'), role: 'ADMIN' });
  let user = await Librarian.findOne({ email });
  let role = 'LIBRARIAN';
  if (!user) { user = await Student.findOne({ email }); role = 'STUDENT'; }
  if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ message: 'Invalid email or password' });
  const library = await Library.findById(user.library);
  if (!libraryCode || library.libraryCode !== libraryCode) return res.status(401).json({ message: 'Valid libraryCode is required' });
  if (user.status !== 'APPROVED') return res.status(403).json({ message: 'Your registration is awaiting approval' });
  res.json({ token: tokenFor(user, role, library.libraryCode), role, user: { id: user._id, name: user.name, email: user.email } });
}));
router.post('/auth/refresh', protect, (req, res) => res.json({ token: signToken(req.user) }));
router.post('/auth/logout', protect, (req, res) => res.status(204).end());

router.post('/libraries/register', asyncRoute(async (req, res) => {
  const library = await Library.create(req.body);
  res.status(201).json({ message: 'Library registration submitted for approval', library });
}));

router.post('/librarians/register', asyncRoute(async (req, res) => {
  const { libraryCode, name, email, password, mobile, totalSeats } = req.body;
  const library = await libraryFor(libraryCode);
  const librarian = await Librarian.create({ library: library._id, name, email, passwordHash: hashPassword(password), mobile, totalSeats });
  res.status(201).json({ message: 'Librarian registration submitted for approval', librarian: { id: librarian._id, status: librarian.status } });
}));

router.post('/students/register', asyncRoute(async (req, res) => {
  const { libraryCode, name, email, password, mobile } = req.body;
  const library = await libraryFor(libraryCode);
  const student = await Student.create({ library: library._id, name, email, passwordHash: hashPassword(password), mobile });
  res.status(201).json({ message: 'Student registered successfully', student: { id: student._id, status: student.status } });
}));

router.get('/admin/libraries', protect, allow('ADMIN'), asyncRoute(async (_req, res) => res.json(await Library.find().sort('-createdAt'))));
router.patch('/admin/libraries/:id/approve', protect, allow('ADMIN'), asyncRoute(async (req, res) => {
  const library = await Library.findById(req.params.id);
  if (!library) return res.status(404).json({ message: 'Library not found' });
  library.status = 'APPROVED';
  library.libraryCode = `${library.pincode}-${library._id.toString().slice(-5).toUpperCase()}`;
  await library.save();
  res.json({ message: 'Library approved', library });
}));
router.patch('/admin/libraries/:id/reject', protect, allow('ADMIN'), asyncRoute(async (req, res) => {
  const library = await Library.findByIdAndUpdate(req.params.id, { status: 'REJECTED' }, { new: true });
  if (!library) return res.status(404).json({ message: 'Library not found' });
  res.json({ message: 'Library rejected', library });
}));
router.get('/admin/librarians', protect, allow('ADMIN'), asyncRoute(async (_req, res) => res.json(await Librarian.find().populate('library', 'name libraryCode').sort('-createdAt'))));
router.patch('/admin/librarians/:id/approve', protect, allow('ADMIN'), asyncRoute(async (req, res) => {
  const librarian = await Librarian.findById(req.params.id);
  if (!librarian) return res.status(404).json({ message: 'Librarian not found' });
  librarian.status = 'APPROVED'; await librarian.save();
  const existingSeats = await Seat.countDocuments({ library: librarian.library });
  if (!existingSeats) await Seat.insertMany(Array.from({ length: librarian.totalSeats }, (_, i) => ({ library: librarian.library, seatNumber: `A${String(i + 1).padStart(2, '0')}` })));
  res.json({ message: 'Librarian approved and seats created', librarian });
}));

router.get('/students/me', protect, allow('STUDENT'), asyncRoute(async (req, res) => {
  const student = await Student.findById(req.user.id).populate('library', 'name libraryCode');
  const [seat, payments, concerns] = await Promise.all([
    Seat.findOne({ 'assignments.student': student._id }), FeePayment.find({ student: student._id }).sort('-paidAt'), Concern.find({ student: student._id }).sort('-createdAt')
  ]);
  res.json({ student, seat, payments, concerns });
}));
router.get('/libraries/students', protect, allow('LIBRARIAN'), asyncRoute(async (req, res) => res.json(await Student.find({ library: req.user.libraryId }).sort('name'))));

const feeStatus = (student, payment) => ({
  status: (payment ? payment.paidAt : student.createdAt) < monthAgo() ? 'OVERDUE' : 'PAID',
  lastPaymentDate: payment?.paidAt || null
});
router.get('/seats', protect, allow('LIBRARIAN'), asyncRoute(async (req, res) => {
  const seats = await Seat.find({ library: req.user.libraryId }).populate('assignments.student', 'name mobile createdAt');
  const studentIds = seats.flatMap((seat) => seat.assignments.map((a) => a.student._id));
  const payments = await FeePayment.find({ student: { $in: studentIds } }).sort('-paidAt');
  const latest = new Map(); payments.forEach((p) => { if (!latest.has(String(p.student))) latest.set(String(p.student), p); });
  res.json(seats.map((seat) => ({
    ...seat.toObject(),
    assignments: seat.assignments.map((a) => ({
      ...a.toObject(),
      fee: feeStatus(a.student, latest.get(String(a.student._id)))
    }))
  })));
}));
router.post('/seats', protect, allow('LIBRARIAN'), asyncRoute(async (req, res) => {
  const seat = await Seat.create({ library: req.user.libraryId, seatNumber: req.body.seatNumber }); res.status(201).json(seat);
}));
router.post('/seats/:id/assign', protect, allow('LIBRARIAN'), asyncRoute(async (req, res) => {
  const { studentId, shift } = req.body;
  const seat = await Seat.findOne({ _id: req.params.id, library: req.user.libraryId });
  const student = await Student.findOne({ _id: studentId, library: req.user.libraryId });
  if (!seat || !student) return res.status(404).json({ message: 'Seat or student not found' });
  if (!['SHIFT_1', 'SHIFT_2'].includes(shift)) return res.status(400).json({ message: 'shift must be SHIFT_1 or SHIFT_2' });
  if (seat.assignments.some((a) => a.shift === shift)) return res.status(409).json({ message: 'This shift is already occupied' });
  await Seat.updateMany({ library: req.user.libraryId }, { $pull: { assignments: { student: student._id } } });
  seat.assignments.push({ student: student._id, shift }); await seat.save(); res.json(seat);
}));
router.patch('/seats/:id/release', protect, allow('LIBRARIAN'), asyncRoute(async (req, res) => {
  const seat = await Seat.findOneAndUpdate({ _id: req.params.id, library: req.user.libraryId }, { $pull: { assignments: { shift: req.body.shift } } }, { new: true });
  if (!seat) return res.status(404).json({ message: 'Seat not found' }); res.json(seat);
}));

router.post('/students/:id/fees', protect, allow('LIBRARIAN'), asyncRoute(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, library: req.user.libraryId });
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const payment = await FeePayment.create({ library: req.user.libraryId, student: student._id, amount: req.body.amount, paidAt: req.body.paidAt || new Date(), recordedBy: req.user.id });
  res.status(201).json(payment);
}));
router.get('/students/me/fees', protect, allow('STUDENT'), asyncRoute(async (req, res) => res.json(await FeePayment.find({ student: req.user.id }).sort('-paidAt'))));
router.get('/fees/pending', protect, allow('LIBRARIAN'), asyncRoute(async (req, res) => {
  const students = await Student.find({ library: req.user.libraryId }); const payments = await FeePayment.find({ library: req.user.libraryId }).sort('-paidAt');
  const latest = new Map(); payments.forEach((p) => { if (!latest.has(String(p.student))) latest.set(String(p.student), p); });
  res.json(students.filter((s) => feeStatus(s, latest.get(String(s._id))).status === 'OVERDUE').map((s) => ({ student: s, fee: feeStatus(s, latest.get(String(s._id)))})));
}));

router.post('/concerns', protect, allow('STUDENT'), asyncRoute(async (req, res) => res.status(201).json(await Concern.create({ library: req.user.libraryId, student: req.user.id, message: req.body.message }))));
router.get('/concerns', protect, allow('LIBRARIAN'), asyncRoute(async (req, res) => res.json(await Concern.find({ library: req.user.libraryId }).populate('student', 'name mobile').sort('-createdAt'))));
router.patch('/concerns/:id/resolve', protect, allow('LIBRARIAN'), asyncRoute(async (req, res) => {
  const concern = await Concern.findOneAndUpdate({ _id: req.params.id, library: req.user.libraryId }, { status: 'RESOLVED' }, { new: true });
  if (!concern) return res.status(404).json({ message: 'Concern not found' }); res.json(concern);
}));

module.exports = router;
