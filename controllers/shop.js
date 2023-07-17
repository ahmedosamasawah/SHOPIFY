const path = require("path");
const fileSystem = require("fs");
const PDFDocument = require("pdfkit");
const stripe = require("stripe")(process.env.STRIPE_KEY);

const Product = require("../models/product");
const Order = require("../models/order");

const ITEMS_PER_PAGE = 3;

exports.getProducts = (request, response, next) => {
  const page = +request.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      response.render("shop/product-list", {
        prods: products,
        pageTitle: "Products",
        path: "/products",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getProduct = (request, response, next) => {
  const prodId = request.params.productId;
  Product.findById(prodId)
    .then((product) => {
      response.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getIndex = (request, response, next) => {
  const page = +request.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      response.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getCart = (request, response, next) => {
  request.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items;
      response.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    })
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.postCart = (request, response, next) => {
  const prodId = request.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return request.user.addToCart(product);
    })
    .then(() => response.redirect("/cart"))
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.postCartDeleteProduct = (request, response, next) => {
  const prodId = request.body.productId;
  request.user
    .removeFromCart(prodId)
    .then(() => response.redirect("/cart"))
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

// exports.postCheckout = async (req, res, next) => {
//   let products;
//   let total = 0;

//   req.user
//     .populate("cart.items.productId")
//     .execPopulate()
//     .then((user) => {
//       products = user.cart.items;
//       products.forEach((p) => {
//         total += p.quantity * p.productId.price;
//       });

//       const lineItems = products.map((p) => {
//         console.log(p.productId.stripeProductId);
//         return {
//           price_data: {
//             product: p.productId.stripeProductId,
//             currency: "egp",
//             unit_amount: p.productId.price * 38,
//           },
//           quantity: p.quantity,
//         };
//       });

//       return stripe.checkout.sessions.create({
//         payment_method_types: ["card"],
//         line_items: lineItems,
//         mode: "payment",
//         success_url: `${req.protocol}://${req.get("host")}/checkout/success`,
//         cancel_url: `${req.protocol}://${req.get("host")}/checkout/cancel`,
//       });
//     })
//     .then((session) => {
//       res.redirect(303, session.url);
//     })
//     .catch((err) => console.log(err));
// };

// exports.postCheckout = async (req, res, next) => {
exports.getCheckout = async (req, res, next) => {
  let products;
  let total = 0;

  req.user
    .populate("cart.items.productId")
    .execPopulate() // I Tried A lot to resolve this issue, But I did not achieve any solutions! So I skipped it.
    .then((user) => {
      products = user.cart.items;
      products.forEach((product) => {
        total += product.quantity * product.productId.price;
      });

      res.render("shop/checkout", {
        path: "/checkout",
        pageTitle: "Checkout",
        products: products,
        totalSum: total,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });

  // // // // // // // // //
  // // // // // // // // //
  // // // // // // // // //
  // // // // // // // // //
  // // // // // // // // //
  // Strip Want's to pay its services to use it, so I skipped it, but here is the code:-
  //   return stripe.checkout.sessions.create({
  //     // payment_method_types: ['card'],
  //     line_items: products.map((product) => {
  //       return {
  //         price: product.productId.stripePriceId,
  //         quantity: product.quantity,
  //       };
  //     }),
  //     mode: "payment",
  //     success_url: `${req.protocol}://${req.get("host")}/checkout/success`,
  //     cancel_url: `${req.protocol}://${req.get("host")}/checkout/cancel`,
  //   });
  // })
  // .then((session) => {
  //   res.redirect(303, session.url);
  // })
  // .catch((err) => console.log(err));
};

// exports.getCheckoutSuccess = (request, response, next) => {
exports.postOrder = (request, response, next) => {
  const token = req.body.stripeToken;
  let totalSum = 0;

  request.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      user.cart.items.forEach((product) => {
        totalSum += product.quantity * product.productId.price;
      });
    })
    .then((user) => {
      const products = user.cart.items.map((item) => {
        return { quantity: item.quantity, product: { ...item.productId._doc } };
      });

      const order = new Order({
        user: {
          email: request.user.email,
          userId: request.user,
        },
        products: products,
      });
      return order.save();
    })
    .then((result) => {
      const charge = stripe.charges.create({
        amount: totalSum * 100,
        currency: "egp",
        description: "Demo Order",
        source: token,
        metadata: { order_id: result._id.toString() },
      });
      return request.user.clearCart();
    })
    .then(() => {
      response.redirect("/orders");
    })
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getOrders = (request, response, next) => {
  Order.find({ "user.userId": request.user._id })
    .then((orders) => {
      response.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((error) => {
      const err = new Error(error);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getInvoice = (request, response, next) => {
  const orderId = request.params.orderId;
  Order.findById(orderId)
    .then((order) => {
      if (!order) return next(new Error("No order found!"));

      if (order.user.userId.toString() !== request.user._id.toString())
        return next(new Error("Unauthorized"));

      const invoiceName = "invoice-" + orderId + ".pdf";
      const invoicePath = path.join("data", "invoices", invoiceName);

      const pdfDoc = new PDFDocument();
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'inline; filename="' + invoiceName + '"'
      );
      pdfDoc.pipe(fileSystem.createWriteStream(invoicePath));
      pdfDoc.pipe(response);

      pdfDoc.fontSize(26).text("Invoice", {
        underline: true,
      });

      pdfDoc.text("-----------------------");
      let totalPrice = 0;
      order.products.forEach((prod) => {
        totalPrice += prod.quantity * prod.product.price;
        pdfDoc
          .fontSize(14)
          .text(
            prod.product.title +
              " - " +
              prod.quantity +
              " x " +
              "$" +
              prod.product.price
          );
      });
      pdfDoc.text("---");
      pdfDoc.fontSize(20).text("Total Price: $" + totalPrice);

      pdfDoc.end();
    })
    .catch((error) => next(error));
};
