const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const { translate } = require("../utils/translation");
const { generateCode, hashCode } = require("../utils/generateCode");
// Controller classes
const { userVerificationEmail } = require("./email.controller");
const EmailController = require("./email.controller");

class UserController {
  #getUsersData = (user, lang = "en") => {
    return {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: user.role,
      profilePicture: user.profilePicture,
      email: user.email,
      dateOfBirth: user.dateOfBirth,
      age: user.age,
      gender: user.genderEn,
      nationalId: user.nationalId,
      verifiedNationalId: user.verifiedNationalId,
      createdAt: user.createdAt,
      loginType: user.loginType,
    };
  };

  login = (user, loginType) =>
    asyncHandler(async (req, res, next) => {
      const { password, email } = req.body;
      const lang = req.headers.lang || "en";

      if (loginType && loginType !== user.loginType)
          return next(new ApiError(translate("Incorrect Email or password", lang), 403));
      else if (!loginType) {
          if (!(await user.comparePassword(password)))
              return next(new ApiError(translate("Incorrect Email or password", lang), 403));
      }

      // Response Msg
      let message = `Welcome back ${user.firstName || ""}!`;

      // Check if user account is deactivated
      if (!user.isActive) {
          const targetDate = new Date(user.deactivatedAt);
          const currentDate = new Date();
          const timeDifference = currentDate - targetDate;
          const millisecondsIn15Days = 15 * 24 * 60 * 60 * 1000;

          if (timeDifference >= millisecondsIn15Days) {
              return next(new ApiError(translate("Incorrect Email or password", lang), 404));
          } else {
              user.deactivatedAt = undefined;
              user.isActive = true;
              message = "Welcome back! Your account has been reactivated.";
          }
      }

      // Check if account is verified
      if (!user.isVerified) {
          const { code, hashedCode } = await generateCode();
          user.verificationCode = hashedCode;
          user.verificationCodeExp = Date.now() + 10 * 60 * 1000;
          await user.save();

          if (user.email) {
              await userVerificationEmail(code, user.email);

              return res.status(200).json({
                  success: true,
                  message: "Verification OTP is sent to your Email",
                  data: {
                      ...this.#getUsersData(user, lang)
                  }
              });
          }
      }

      if (user.isBlocked)
          return next(
              new ApiError(
                  translate("Your account is blocked, please contact the support team", lang),
                  403
              )
          );

      // generate token
      const token = await user.generateToken();

      // Save notification token
      if (req.body.notificationToken) user.notificationToken = req.body.notificationToken;
      await user.save();

      // Remove password from the response
      user.password = undefined;
      user.isVerified = undefined;
      user.isActive = undefined;

      // response
      res.status(200).json({
          success: true,
          message,
          data: {
              ...this.#getUsersData(user, lang),
              // unseenNotifications,
              ...token
          }
      });
  });


  // @desc    Log In
  // @route   POST /user/auth/login
  // @access  Public
  userLogin = asyncHandler(async (req, res, next) => {
      const { email, password, loginType, phone } = req.body;
      const lang = req.headers.lang || "en";

      const userFilter = phone ? { phone } : { email };
      let query = User.findOne(userFilter, null, {
          userLocationPopulation: true,
          skipPopulation: false
      });
      query.lang = lang;
      let user = await query;

      if (loginType) {
          if (!user)
              return res.status(200).json({
                  success: true,
                  message: "Please, Complete your profile!",
                  signUpForFirstTime: true
              });
          else return await this.login(user, loginType)(req, res, next);
      } else {
          if (!user) return next(new ApiError(translate("Incorrect Email or password", lang), 403));
          return await this.login(user, loginType)(req, res, next);
      }
  });

  // @desc    Sign Up
  // @route   POST /user/auth/register
  // @access  Public
  userRegister = async (req, res, next) => {
    console.log("++++++++++++++++++++++++");
    console.log(req.body.notificationToken);
    console.log("++++++++++++++++++++++++");

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        console.log(" 🚀~ Req.body ~ in User register", req.body);

        // Create a new user
        let user = await User.create(
            [
                {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    genderAr: req.body.genderAr,
                    genderEn: req.body.genderEn,
                    email: req.body.email,
                    dateOfBirth: req.body.dateOfBirth,
                    profilePicture: req.body.image || req.body.profilePicture,
                    loginType: req.body.loginType,
                    notificationToken: req.body.notificationToken,
                    password: req.body.password
                }
            ],
            { session }
        );
        user = user[0];

        // Generate a verification code
        const { code, hashedCode } = await generateCode();
        user.verificationCode = hashedCode;
        user.verificationCodeExp = Date.now() + 10 * 60 * 1000;

        await user.save({ session });

        const { email, loginType } = req.body;

        // For non-email login types, mark as verified immediately
        if (loginType && loginType !== "email") {
            user.isVerified = true;
            const token = await user.generateToken();
            await user.save({ session });
            await session.commitTransaction();

            user = await User.findById(user._id, null, {
                lang: req.headers.lang,
                userLocationPopulation: true
            });

            res.status(200).json({
                success: true,
                message: "Account Created and verified successfully",
                data: {
                    ...this.#getUsersData(user, req.headers.lang),
                    ...token
                }
            });
        } else if (email) {
            // Send verification email only
            await userVerificationEmail(code, email);
            await session.commitTransaction();

            user = await User.findById(user._id, null, {
                lang: req.headers.lang,
                userLocationPopulation: true
            });

            res.status(200).json({
                success: true,
                message: "Verification OTP is sent to your Email",
                data: {
                    ...this.#getUsersData(user, req.headers.lang)
                }
            });
        }
    } catch (err) {
        await session.abortTransaction();
        next(err);
    } finally {
        session.endSession();
    }
  };

}

module.exports = new UserController();
