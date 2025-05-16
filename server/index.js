require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Recipe = require("./models/Recipe");
const { GoogleGenerativeAI } = require("@google/generative-ai");


const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

// Basic Route
app.get("/", (req, res) => {
  res.send("AI-Powered Recipe Recommender Backend is Running");
});
// GET All Recipes
app.get("/api/recipes", async (req, res) => {
  try {
    const recipes = await Recipe.find();
    res.status(200).json(recipes);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch recipes", error });
  }
});
// GET Recipe by ID
app.get("/api/recipes/:id", async (req, res) => {
  try {
    // Validate MongoDB ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid recipe ID format" });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });

    res.status(200).json(recipe);
  } catch (error) {
    console.error('Recipe fetch error:', error);
    res.status(500).json({ 
      message: "Failed to fetch recipe", 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
});
// UPDATE Recipe by ID
app.put("/api/recipes/:id", async (req, res) => {
  try {
    const { title, ingredients, instructions, image, nutrition } = req.body;
    
    // Validate MongoDB ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid recipe ID format" });
    }
    
    // Validate ingredients type if provided
    if (ingredients && !Array.isArray(ingredients)) {
      return res.status(400).json({ message: "Ingredients must be an array" });
    }

    const updatedRecipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      { title, ingredients, instructions, image, nutrition },
      { 
        new: true, // Return updated document
        runValidators: true // Run Mongoose validators
      }
    );

    if (!updatedRecipe)
      return res.status(404).json({ message: "Recipe not found" });

    res.status(200).json(updatedRecipe);
  } catch (error) {
    console.error('Recipe update error:', error);
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: "Validation failed", 
        details: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }
    // General error
    res.status(500).json({ 
      message: "Failed to update recipe", 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
});
// DELETE Recipe by ID
app.delete("/api/recipes/:id", async (req, res) => {
  try {
    // Validate MongoDB ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid recipe ID format" });
    }

    const deletedRecipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!deletedRecipe)
      return res.status(404).json({ message: "Recipe not found" });

    res.status(200).json({ message: "Recipe deleted successfully" });
  } catch (error) {
    console.error('Recipe deletion error:', error);
    res.status(500).json({ 
      message: "Failed to delete recipe", 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});


app.post("/api/recipes", async (req, res) => {
  try {
    const { title, ingredients, instructions, image, nutrition } = req.body;
    
    // Validate required fields
    if (!title || !ingredients || !instructions) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        details: {
          title: title ? null : "Title is required",
          ingredients: ingredients ? null : "Ingredients are required",
          instructions: instructions ? null : "Instructions are required"
        }
      });
    }

    // Validate data types
    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ message: "Ingredients must be an array" });
    }

    const newRecipe = new Recipe({
      title,
      ingredients,
      instructions,
      image,
      nutrition,
    });

    await newRecipe.save();
    res.status(201).json(newRecipe);
  } catch (error) {
    console.error('Recipe creation error:', error);
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: "Validation failed", 
        details: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }
    // General error
    res.status(500).json({ 
      message: "Failed to create recipe", 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
});

// Generate Recipe with Gemini
app.post('/api/recipes/generate', async (req, res) => {
  const { ingredients, dietaryRestrictions } = req.body;

  // Validate inputs
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ message: 'Please provide a non-empty array of ingredients' });
  }

  try {
    const prompt = `Generate a recipe using the following ingredients: ${ingredients.join(', ')}.
    Ensure it adheres to these dietary restrictions: ${dietaryRestrictions || 'none'}.
    Please format your response with clear sections as follows:
    Title: [recipe title]
    Ingredients: 
    - [ingredient 1]
    - [ingredient 2]
    ...
    Instructions:
    1. [step 1]
    2. [step 2]
    ...`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    // Improved parsing with better regex and fallbacks
    const titleMatch = text.match(/Title:\s*(.+?)(?=\n|$)/i);
    const ingredientsSection = text.match(/Ingredients:\s*([\s\S]+?)(?=Instructions:|$)/i);
    const instructionsSection = text.match(/Instructions:\s*([\s\S]+)/i);

    // Process ingredients to an array, handling bullet points, numbers, or simple lines
    let ingredientsList = [];
    if (ingredientsSection && ingredientsSection[1]) {
      ingredientsList = ingredientsSection[1]
        .trim()
        .split('\n')
        .map(line => line.replace(/^[-•*\d]+\.?\s*/, '').trim())
        .filter(line => line.length > 0);
    }

    // Process instructions
    let instructionsList = [];
    if (instructionsSection && instructionsSection[1]) {
      // First split by line breaks
      const lines = instructionsSection[1]
        .trim()
        .split('\n')
        .map(line => line.replace(/^\d+\.?\s*/, '').trim())
        .filter(line => line.length > 0);
      
      // Then split each line by sentences and flatten the array
      instructionsList = lines.flatMap(line => {
        // Split by periods, exclamation marks, or question marks followed by space or end of string
        // But keep the punctuation with the sentence
        const sentences = line.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [line];
        return sentences.map(s => s.trim()).filter(s => s.length > 0);
      });
    }

    const generatedRecipe = {
      title: titleMatch ? titleMatch[1].trim() : 'Generated Recipe',
      ingredients: ingredientsList,
      instructions: instructionsList,
      originalAIResponse: text // Include the full response for debugging
    };

    res.status(200).json(generatedRecipe);
  } catch (error) {
    console.error('Recipe generation error:', error);
    res.status(500).json({ 
      message: 'Failed to generate recipe', 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
