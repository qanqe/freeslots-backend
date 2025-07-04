// middlewares/validation.js
const Joi = require('joi');

// Reusable validation wrapper
const validate = (schema, property) => (req, res, next) => {
  const { error } = schema.validate(req[property], {
    abortEarly: false,
    allowUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

// --- User Route Validations ---

exports.validateAuthUser = validate(Joi.object({
  telegramId: Joi.string().optional().messages({
    'string.empty': 'telegramId cannot be empty',
  }),
  username: Joi.string().allow('', null).optional().messages({
    'string.base': 'username must be a string',
  }),
  referrerId: Joi.string().optional().allow(null, '').messages({
    'string.empty': 'referrerId cannot be empty if provided',
  }),
}), 'body');

exports.validateSpin = validate(Joi.object({
  telegramId: Joi.string().optional(),
}), 'body');

exports.validateFreeSpin = validate(Joi.object({
  telegramId: Joi.string().optional(),
}), 'body');

exports.validateCheckIn = validate(Joi.object({
  telegramId: Joi.string().optional(),
}), 'body');

exports.validateReferral = validate(Joi.object({
  telegramId: Joi.string().required().messages({
    'string.empty': 'telegramId cannot be empty',
    'any.required': 'telegramId is required',
  }),
  referrerId: Joi.string().required().messages({
    'string.empty': 'referrerId cannot be empty',
    'any.required': 'referrerId is required',
  }),
}), 'body');

// --- Admin Route Validations ---

exports.validatePromoteUser = validate(Joi.object({
  targetTelegramId: Joi.string().required().messages({
    'string.empty': 'targetTelegramId cannot be empty',
    'any.required': 'targetTelegramId is required',
  }),
}), 'body');

exports.validateTelegramIdBody = validate(Joi.object({
  telegramId: Joi.string().required().messages({
    'string.empty': 'telegramId cannot be empty',
    'any.required': 'telegramId is required',
  }),
}), 'body');

exports.validateTelegramIdParam = validate(Joi.object({
  telegramId: Joi.string().required().messages({
    'string.empty': 'telegramId parameter cannot be empty',
    'any.required': 'telegramId parameter is required',
  }),
}), 'params');
