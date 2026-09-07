import seatRepository from '../../modules/seats/repositories/seat.repository.js';

const requireSeatAssignment = async (req, res, next) => {
  if (req.user.role !== 'STUDENT') return next();

  try {
    const seat = await seatRepository.findOne({
      library: req.user.libraryId,
      'assignments.student': req.user.id,
    });

    if (!seat) {
      return res.status(403).json({
        message: 'A seat assignment is required to access this feature',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default requireSeatAssignment;
