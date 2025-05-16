const mongoose = require("mongoose");

const RecipeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  ingredients: {
    type: [String],
    required: true,
  },
  instructions: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: "",
  },
  nutrition: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    carbohydrates: { type: Number, default: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Recipe = mongoose.model("Recipe", RecipeSchema);
module.exports = Recipe;
