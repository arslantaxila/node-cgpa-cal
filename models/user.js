const Joi = require("joi");

function validateUser(user) {
  const schema = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    email: Joi.string().email({
      minDomainSegments: 2,
    }),
    enrollment: Joi.string().allow("").max(50).optional(),
    cnic: Joi.string()
      .min(13)
      .max(13)
      .pattern(/^[0-9]{13}$/)
      .allow("")
      .optional(),
    password: Joi.string().allow("").required(),
    role: Joi.number().optional().messages({
      "number.base": "Role Id must be a number"
    })
  });

  return schema.validate(user);
}

module.exports.validateuser = validateUser;