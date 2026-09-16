import StudentHistory from '../entities/student-history.entity.js';

const create = (data) => StudentHistory.create(data);
const findByLibrary = (library) => StudentHistory.find({ library }).sort('-leftAt');
const findByStudent = (student) => StudentHistory.findOne({ student }).sort('-leftAt');

export { create, findByLibrary, findByStudent };
