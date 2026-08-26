import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
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
