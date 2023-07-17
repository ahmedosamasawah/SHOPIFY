const path = require("path");
const csrf = require("csurf");
const https = require("https");
const multer = require("multer");
const dotenv = require("dotenv");
const helmet = require("helmet");
const fileSystem = require("fs");
const express = require("express");
const morgan = require("morgan");
const mongoose = require("mongoose");
const flash = require("connect-flash");
const bodyParser = require("body-parser");
const session = require("express-session");
const compression = require("compression");
const isAuth = require("./middleware/is-auth");
const shopController = require("./controllers/shop");
const errorController = require("./controllers/error");
const MongoDBStore = require("connect-mongodb-session")(session);

const User = require("./models/user");

dotenv.config();
const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.0dvsymx.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}`;

const app = express();

const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
});

const csrfProtection = csrf();

const fileStorage = multer.diskStorage({
  destination: (request, file, callBack) => callBack(null, "images"),
  filename: (request, file, callBack) =>
    callBack(null, Date.now().toString() + "-" + file.originalname),
});

const fileFilter = (request, file, callBack) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    callBack(null, true);
  } else {
    callBack(null, false);
  }
};

app.set("view engine", "ejs");
app.set("views", "views");

// Import and use routes
const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

// Apply middleware functions
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  multer({
    storage: fileStorage,
    fileFilter: fileFilter,
  }).single("image")
);

app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));

app.use(
  session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(csrfProtection);

app.use(flash());

app.use((request, response, next) => {
  response.locals.isAuthenticated = request.session.isLoggedIn;
  response.locals.csrfToken = request.csrfToken();
  next();
});

// app.use(bodyParser.json());

app.use((request, response, next) => {
  if (!request.session.user) return next();

  User.findById(request.session.user._id)
    .then((user) => {
      if (!user) return next();

      request.user = user;
      next();
    })
    .catch((error) => next(new Error(error)));
});

app.post("/create-order", shopController.postOrder);
app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

// Handle errors
app.get("/500", errorController.get500);
app.use(errorController.get404);

app.use((error, req, res, next) => {
  console.log(error);
  console.log("Error from Middleware!");
  res.redirect("/500");
});

mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => app.listen(3000))
  .catch((error) => console.log(error));
