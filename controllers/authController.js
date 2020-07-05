const passport = require("passport");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const crypto = require("crypto");
const { promisify } = require("util");
const mail = require("../handlers/mail");

exports.login = passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: "Failed Login!",
    successRedirect: "/",
    successMessage: "You are now Logged In!",
});

exports.logout = (req, res) => {
    req.logout();
    req.flash("success", "You are now logged out!");
    res.redirect("/");
};

exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        next();
        return;
    }
    req.flash("error", "You must be logged in!");
    res.redirect("/login");
};

exports.forgot = async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        req.flash("error", "User does not exists");
        res.redirect("/login");
        return;
    }

    user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();
    const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;

    await mail.send({
        user,
        subject: `Password Reset | Now That's Delicious`,
        resetURL,
        filename: "password-reset",
    });

    req.flash("success", `You have been emailed a password reset link.`);
    res.redirect("/login");
};

exports.reset = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
        req.flash("error", "Password reset is invalid or has expired");
        return res.redirect("/login");
    }
    res.render("reset", { title: "Reset Your Password" });
};

exports.checkPasswords = (req, res, next) => {
    if (req.body.password === req.body["password-confirm"]) {
        next();
        return;
    }
    req.flash("error", "Password do not match!");
    res.redirect("back");
};

exports.update = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
        req.flash("error", "Password reset is invalid or has expired");
        return res.redirect("/login");
    }

    const setPassword = promisify(user.setPassword).bind(user);
    await setPassword(req.body.password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    const updatedUser = await user.save();
    await req.login(updatedUser);
    req.flash("success", "Nice! Your password has been reset");
    res.redirect("/");
};
