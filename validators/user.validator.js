const Joi = require("joi");
const asyncHandler = require("express-async-handler");
const joiErrorHandler = require("./joiErrorHandler");
const {
  phoneNumberValidator,
} = require("./validatorComponents");
const ApiError = require("../utils/ApiError");
const { translate } = require("../utils/translation");
const User = require("../models/user.model");
const {
  GENDER_LIST_EN,
  GENDER_LIST_AR,
  LOGIN_TYPE_PLATFORM_LIST,
  LANGS,
} = require("../utils/constants");
/**
 * UserValidator class for validating user registration requests.
 *
 * This class contains methods for validating user data during the registration process using Joi and additional checks.
 */
class UserValidator {
  validateRegisterUser = asyncHandler(async (req, res, next) => {
    const schema = Joi.object({
      firstName: Joi.string()
        .when("loginType", {
          is: Joi.valid(...LOGIN_TYPE_PLATFORM_LIST),
          then: Joi.optional().allow(""),
          otherwise: Joi.required(),
        })
        .min(2)
        .max(32)
        .messages({ "any.required": "First Name is required" }),

      lastName: Joi.string()
        .when("loginType", {
          is: Joi.valid(...LOGIN_TYPE_PLATFORM_LIST),
          then: Joi.optional().allow(""),
          otherwise: Joi.required(),
        })
        .min(2)
        .max(32)
        .messages({ "any.required": "Last Name is required" }),

      email: Joi.string().email().required().messages({
        "any.required": "Email is required",
        "string.email": "Invalid Email Address",
      }),

      profilePicture: Joi.string().optional(),

      gender: Joi.string()
        .valid(...GENDER_LIST_EN)
        .required()
        .messages({ "any.required": "Gender is required" }),

      dateOfBirth: Joi.date()
        .required()
        .messages({ "any.required": "Date of Birth is required" }),

      loginType: Joi.string().optional(),

      password: Joi.string()
        .min(6)
        .when("loginType", { is: Joi.exist(), then: Joi.optional() })
        .messages({
          "string.min": "Password must be at least 6 characters",
          "any.required": "Password is required",
        }),

      confirmPassword: Joi.string()
        .valid(Joi.ref("password"))
        .when("loginType", { is: Joi.exist(), then: Joi.optional() })
        .messages({
          "any.required": "Confirm Password is required",
          "any.only": "Passwords do not match",
        }),

      notificationToken: Joi.string().optional(),
    });

    joiErrorHandler(schema, req);
    next();
  });
  
}

module.exports = new UserValidator();
