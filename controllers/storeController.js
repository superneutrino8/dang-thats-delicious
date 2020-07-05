const mongoose = require("mongoose");
const Store = mongoose.model("Store");
const multer = require("multer");
const jimp = require("jimp");
const uuid = require("uuid");
const User = require("../models/User");

const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith("image/");
        if (isPhoto) {
            next(null, true);
        } else {
            next({ message: `That filetype isn't allowed` }, false);
        }
    },
};

exports.homePage = (req, res) => {
    console.log(req.name);
    res.render("index");
};

exports.addStore = (req, res) => {
    res.render("editStore", { title: "Add Store" });
};

exports.upload = multer(multerOptions).single("photo");

exports.resize = async (req, res, next) => {
    if (!req.file) {
        next();
        return;
    }
    const extention = req.file.mimetype.split("/")[1];
    req.body.photo = `${uuid.v4()}.${extention}`;
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(800, jimp.AUTO);
    await photo.write(`./public/uploads/${req.body.photo}`);
    next();
};

exports.createStore = async (req, res) => {
    req.body.author = req.user._id;
    const store = await new Store(req.body).save();
    req.flash("success", `Successfully created ${store.name}.`);
    res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
    const page = req.params.page || 1;
    const limit = 4;
    const skip = limit * page - limit;

    const storesPromise = Store.find()
        .skip(skip)
        .limit(limit)
        .sort({ created: "desc" });
    const countPromise = Store.count();

    const [stores, count] = await Promise.all([storesPromise, countPromise]);
    const pages = Math.ceil(count / limit);

    if (!stores.length && skip) {
        req.flash("info", `Out of page limit`);
        res.redirect(`/stores/page/${pages}`);
        return;
    }
    res.render("stores", { title: `Stores`, stores, page, pages, count });
};

const confirmOwner = (store, user) => {
    if (!store.author.equals(user._id)) {
        throw Error("You must be owner in order to edit store!");
    }
};

exports.editStore = async (req, res) => {
    const store = await Store.findOne({ _id: req.params.id });
    confirmOwner(store, req.user);
    res.render("editStore", { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
    req.body.location.type = "Point";
    const store = await Store.findOneAndUpdate(
        { _id: req.params.id },
        req.body,
        {
            new: true,
            runValidators: true,
        }
    ).exec();
    req.flash(
        "success",
        `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}/">View Store</a>`
    );
    res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug }).populate(
        "author reviews"
    );
    if (!store) return next();
    res.render("store", { store, title: store.name });
};

exports.getStoreByTags = async (req, res) => {
    const tag = req.params.tag;
    const tagQuery = tag || { $exists: true };
    const tagsPromise = Store.getTagList();
    const storePromise = Store.find({ tags: tagQuery });
    const [tags, stores] = await Promise.all([tagsPromise, storePromise]);

    res.render("tags", { tags, title: "Tags", tag, stores });
};

exports.search = async (req, res) => {
    const stores = await Store.find(
        {
            $text: {
                $search: req.query.q,
            },
        },
        {
            score: {
                $meta: "textScore",
            },
        }
    )
        .sort({
            score: {
                $meta: "textScore",
            },
        })
        .limit(5);
    res.json(stores);
};

exports.mapStores = async (req, res) => {
    const coordinates = [req.query.lat, req.query.lng].map(parseFloat);
    const q = {
        location: {
            $near: {
                $geometry: {
                    type: "Point",
                    coordinates,
                },
                $maxDistance: 10000, // 10km
            },
        },
    };

    const stores = await Store.find(q)
        .select("slug name description location photo")
        .limit(10);
    res.json(stores);
};

exports.mapPage = (req, res) => {
    res.render("map", { title: "Maps" });
};

exports.heartStores = async (req, res) => {
    const hearts = req.user.hearts.map((obj) => obj.toString());
    const operator = hearts.includes(req.params.id) ? "$pull" : "$addToSet";
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            [operator]: { hearts: req.params.id },
        },
        { new: true }
    );
    res.json(user);
};

exports.hearts = async (req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts },
    });
    res.render("stores", { title: "Hearted Stores", stores });
};

exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores();
    // res.json(stores);
    res.render("topStores", { stores, title: "Top Stores!" });
};
