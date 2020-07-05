const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const slug = require("slugs");
const { exists } = require("./User");

const storeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
            required: "Please enter a store name!",
        },
        slug: String,
        description: {
            type: String,
            trim: true,
        },
        tags: [String],
        created: {
            type: Date,
            default: Date.now,
        },
        location: {
            type: {
                type: String,
                default: "Point",
            },
            address: {
                type: String,
                required: "Please supply the Address!",
            },
            coordinates: [
                {
                    type: Number,
                    required: "PLease supply the Coordinates!",
                },
            ],
        },
        photo: String,
        author: {
            type: mongoose.Schema.ObjectId,
            ref: "User",
            required: "Please supply an Author!",
        },
    },
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

storeSchema.index({
    name: "text",
    description: "text",
});

storeSchema.index({
    location: "2dsphere",
});

storeSchema.pre("save", async function(next) {
    if (!this.isModified("name")) {
        next(); // skip it
        return; // stop this function from running
    }
    this.slug = slug(this.name);

    const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, "i");

    const storesWithSlug = await this.constructor.find({ slug: slugRegEx });

    if (storesWithSlug) {
        this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
    }

    next();
    // TODO make more resiliant so slugs are unique
});

storeSchema.statics.getTagList = function() {
    return this.aggregate([
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
    ]);
};

storeSchema.statics.getTopStores = function() {
    return this.aggregate([
        // lookup stores and populate their reviews
        {
            $lookup: {
                from: "reviews",
                localField: "_id",
                foreignField: "store",
                as: "reviews",
            },
        },
        // filter for only items that have 2 or more reviews
        {
            $match: {
                "reviews.1": { $exists: true },
            },
        },
        // Add the average revies field

        {
            $addFields: {
                averageRating: { $avg: "$reviews.rating" },
            },
        },
        // sort it by our new field, highest reviews first
        {
            $sort: {
                averageRating: -1,
            },
        },
        // limi to at most 10
        {
            $limit: 10,
        },
    ]);
};

storeSchema.virtual("reviews", {
    ref: "Review",
    localField: "_id",
    foreignField: "store",
});

function autopopulate(next) {
    this.populate("reviews");
    next();
}

storeSchema.pre("find", autopopulate);
storeSchema.pre("findOne", autopopulate);

module.exports = mongoose.model("Store", storeSchema);
