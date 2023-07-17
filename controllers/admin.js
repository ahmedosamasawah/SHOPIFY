const fileHelper = require("../util/file");
const { validationResult } = require("express-validator");

const Product = require("../models/product");

exports.getAddProduct = (request, response, next) => {
  response.render("admin/edit-product", {
    pageTitle: "Add Product",
    path: "/admin/add-product",
    editing: false,
    hasError: false,
    errorMessage: null,
    validationErrors: [],
  });
};

exports.postAddProduct = (request, response, next) => {
  const title = request.body.title;
  const image = request.file;
  const price = request.body.price;
  const description = request.body.description;

  if (!image) {
    return response.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/add-product",
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description,
      },
      errorMessage: "Attached file is not an image!",
      validationErrors: [],
    });
  }
  const errors = validationResult(request);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return response.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/add-product",
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description,
      },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  const imageUrl = image.path;

  const product = new Product({
    title: title,
    price: price,
    imageUrl: imageUrl,
    userId: request.user,
    description: description,
    stripeProductId: request.user,
  });

  product
    .save()
    .then(() => response.redirect("/admin/products"))
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getEditProduct = (request, response, next) => {
  const editMode = request.query.edit;
  if (!editMode) return response.redirect("/");

  const prodId = request.params.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) return response.redirect("/");

      response.render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/edit-product",
        editing: editMode,
        product: product,
        hasError: false,
        errorMessage: null,
        validationErrors: [],
      });
    })
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.postEditProduct = (request, response, next) => {
  const image = request.file;
  const prodId = request.body.productId;
  const updatedTitle = request.body.title;
  const updatedPrice = request.body.price;
  const updatedDesc = request.body.description;

  const errors = validationResult(request);

  if (!errors.isEmpty()) {
    return response.status(422).render("admin/edit-product", {
      pageTitle: "Edit Product",
      path: "/admin/edit-product",
      editing: true,
      hasError: true,
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
        _id: prodId,
      },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  Product.findById(prodId)
    .then((product) => {
      if (product.userId.toString() !== request.user._id.toString())
        return response.redirect("/");

      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      if (image) {
        fileHelper.deleteFile(product.imageUrl);
        product.imageUrl = image.path;
      }
      return product.save().then(() => response.redirect("/admin/products"));
    })
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getProducts = (request, response, next) => {
  Product.find({ userId: request.user._id })
    .then((products) => {
      response.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
      });
    })
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.deleteProduct = (request, response, next) => {
  const prodId = request.params.productId;

  Product.findById(prodId)
    .then((product) => {
      if (!product) return next(new Error("Product not found."));

      fileHelper.deleteFile(product.imageUrl);
      return Product.deleteOne({ _id: prodId, userId: request.user._id });
    })
    .then(() => response.status(200).json({ message: "Success!" }))
    .catch((error) =>
      response.status(500).json({ message: "Deleting product failed." })
    );
};
