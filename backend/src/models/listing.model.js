import mongoose from "mongoose";

export const LISTING_EVENT_TYPES = [
  "listed",
  "sc-assigned",
  "status-changed",
  "remark-added",
  "profiles-updated",
  "poc-added",
];

const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: LISTING_EVENT_TYPES,
      required: true,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    byRole: {
      type: String,
      enum: ["admin", "dpr", "sc", "system"],
      default: "system",
    },
    byName: {
      type: String,
      trim: true,
      default: "",
    },
    // Free-form payload, shape depends on `type`:
    //   listed           -> { }
    //   sc-assigned      -> { scEmail, from? }
    //   status-changed   -> { poc, pocName, from, to }
    //   remark-added     -> { poc, text }
    //   profiles-updated -> { profiles }
    //   poc-added        -> { poc, pocName }
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const listingSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    profiles: {
      type: [String],
      default: [],
    },
    // User who added the company to the portal.
    listedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // User who proposed the company (may differ from listedBy).
    proposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // Student coordinator currently assigned to this listing.
    assignedSC: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    pocs: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          auto: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        email: {
          type: String,
          trim: true,
          lowercase: true,
        },
        phone: {
          type: String,
          trim: true,
        },
        // Denormalized current state derived from status-changed events;
        // kept for fast filtering.
        status: {
          type: String,
          enum: [
            "onboarded",
            "ongoing",
            "yet to contact",
            "first email sent",
            "follow up sent",
            "rejected",
          ],
          default: "yet to contact",
        },
      },
    ],
    events: [eventSchema],
  },
  {
    timestamps: true,
  }
);

listingSchema.index({ company: 1 }, { unique: true });

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
