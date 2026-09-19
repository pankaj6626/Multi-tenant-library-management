const createSeatStatusService = ({ feeRepository, concernRepository }) => {
  const overdue = (student, payment) => ({
    status: (payment ? payment.paidAt : student.createdAt) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ? 'OVERDUE'
      : 'PAID',
    lastPaymentDate: payment?.paidAt || null,
  });

  const enrich = async (seats) => {
    const studentIds = seats.flatMap((seat) => seat.assignments.map((assignment) => assignment.student._id));
    const [payments, openConcerns] = await Promise.all([
      feeRepository.findByStudents(studentIds),
      concernRepository.findOpenByStudents(studentIds),
    ]);

    const latestPaymentByStudent = new Map();
    const studentsWithOpenConcerns = new Set(openConcerns.map((concern) => String(concern.student)));

    payments.forEach((payment) => {
      if (!latestPaymentByStudent.has(String(payment.student))) {
        latestPaymentByStudent.set(String(payment.student), payment);
      }
    });

    return seats.map((seat) => ({
      ...seat.toObject(),
      assignments: seat.assignments.map((assignment) => {
        const hasOpenConcern = studentsWithOpenConcerns.has(String(assignment.student._id));
        const student = assignment.student.toObject();

        return {
          ...assignment.toObject(),
          student: {
            ...student,
            name: hasOpenConcern ? `${student.name} \u{1F64B}` : student.name,
          },
          fee: overdue(assignment.student, latestPaymentByStudent.get(String(assignment.student._id))),
          hasOpenConcern,
        };
      }),
    }));
  };

  return { enrich, overdue };
};

export default createSeatStatusService;
