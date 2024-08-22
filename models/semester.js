const Joi = require("joi");

function validateSemester(semester) {
    const schema = Joi.object({
        semester: Joi.string().required(),
        gpa: Joi.number().required(),
        // courses: Joi.string().required()
        courses: Joi.array().items(
            Joi.object({
                id: Joi.number().optional(),
                name: Joi.string().required(),
                code: Joi.string().required(),
                credit_hour: Joi.number().required(),
                marks: Joi.number().required(),
                credit_hour: Joi.number().required(),
                gpa: Joi.number().required(),
            })
        ).required()
    });

    return schema.validate(semester);
}

function validateImportSemester(semester) {
    const schema = Joi.array().items(
        Joi.object({
            semester: Joi.string().valid('Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
            'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8', 'Semester 9', 'Semester 10',
            'Semester 11', 'Semester 12', 'Semester 13', 'Semester 14', 'Semester 15'
            ).required(),
            course: Joi.string().required(),
            code: Joi.string().required(),
            marks: Joi.number().required(),
            credit_hour: Joi.number().required(),
        })
    );
    return schema.validate(semester);
}

module.exports.validatesemester = validateSemester;
module.exports.validateimportsemester = validateImportSemester;
