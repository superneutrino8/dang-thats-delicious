const mongoose = require("mongoose");
const User = mongoose.model("User");
const { promisify } = require("util");

exports.loginUser = (req, res) => {
    res.render("login", { title: "Log In" });
};

exports.registerUser = (req, res) => {
    res.render("register", { title: "Register" });
};

exports.validateUser = (req, res, next) => {
    req.sanitizeBody("name");

    req.checkBody("name", "You must supply a name").notEmpty();

    req.checkBody("email", "That Email is not valid!").isEmail();

    req.sanitizeBody("email").normalizeEmail({
        remove_dots: false,
        remove_extension: false,
        gmail_remove_subaddress: false,
    });

    req.checkBody("password", "Password cannot be blank").notEmpty();

    req.checkBody(
        "password-confirm",
        "Confirm Password cannot be blank"
    ).notEmpty();

    req.checkBody("password-confirm", "Opps! Password do not match").equals(
        req.body.password
    );

    const errors = req.validationErrors();
    if (errors) {
        req.flash(
            "error",
            errors.map((err) => err.msg)
        );
        res.render("register", {
            body: req.body,
            title: "Register",
            flashes: req.flash(),
        });
        return;
    }
    next();
};

exports.register = async (req, res, next) => {
    const user = new User({ email: req.body.email, name: req.body.name });
    const register = promisify(User.register).bind(User);
    await register(user, req.body.password);
    next();
};

exports.account = (req, res) => {
    res.render("account", { title: "Edit Your Account" });
};

exports.updateUser = async (req, res) => {
    const update = {
        name: req.body.name,
        email: req.body.email,
    };
    const user = await User.findOneAndUpdate(
        { _id: req.user._id },
        { $set: update },
        { new: true, runValidators: true, context: "query" }
    );
    req.flash("success", "Profile updated!");
    res.redirect("back");
};
