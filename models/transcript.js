const Joi = require("joi");

function validateTranscript(transcript) {
    const schema = Joi.object({
        type: Joi.string().required(),
        email: Joi.string().email({
            minDomainSegments: 2,
        }),
        mobile: Joi.string()
            .min(11)
            .max(11)
            .pattern(/^[0-9]{11}$/)
            .required(),
        cnic: Joi.string()
            .min(13)
            .max(13)
            .pattern(/^[0-9]{13}$/)
            .required(),
    });

    return schema.validate(transcript);
}

module.exports.validatetranscript = validateTranscript;