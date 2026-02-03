const appRouter = require("express").Router();
const BASE_URL = "/api/v1";

const ApiError = require("../utils/ApiError");
let userAuthRoutes = require("./userAuth.routes")

const { app } = require("firebase-admin");


appRouter.use(`${BASE_URL}/users/auth`, userAuthRoutes);

appRouter.get("/", (req, res) => {
  res.status(200).json({
    status: true,
    message: "You're Server is up and running!"
  });
});

// Not Found Route
appRouter.use((req, res, next) => {
  next(new ApiError(`This Route (${req.originalUrl}) is not found`, 404));
});


module.exports = appRouter;
