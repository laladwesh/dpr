import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    dprUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    scUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    dprEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    scEmail: {
      type: String,
      trim: true,
      default: null,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameNormalized: {
      type: String,
      trim: true,
      index: true,
      unique: true,
      sparse: true,
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
        status: {
          type: String,
          enum: ["onboarded", "ongoing", "yet to contact", "rejected"],
          default: "yet to contact",
        },
        remarks: [
          {
            role: {
              type: String,
              enum: ["sc", "dpr", "admin"],
              required: true,
            },
            author: {
              type: String,
              trim: true,
              required: true,
            },
            authorEmail: {
              type: String,
              trim: true,
              lowercase: true,
              default: "",
            },
            text: {
              type: String,
              trim: true,
              required: true,
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    ],
    profiles: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

companySchema.pre("validate", function setNormalizedName(next) {
  if (this.name) {
    this.nameNormalized = this.name.trim().replace(/\s+/g, " ").toLowerCase();
  }
  next();
});

const Company = mongoose.model("Company", companySchema);

export default Company;
