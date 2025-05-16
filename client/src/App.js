import React, { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [ingredients, setIngredients] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [generatedRecipe, setGeneratedRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerateRecipe = async () => {
    setLoading(true);
    setError("");
    setGeneratedRecipe(null);

    try {
      const response = await axios.post("https://ai-recipe-recommendation.onrender.com", {
        ingredients: ingredients.split(",").map((item) => item.trim()),
        dietaryRestrictions,
      });

      setGeneratedRecipe(response.data);
    } catch (err) {
      setError("Failed to generate recipe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>AI-Powered Recipe Recommender</h1>
      <div className="input-container">
        <textarea
          placeholder="Enter ingredients (comma-separated)"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
        ></textarea>
        <input
          type="text"
          placeholder="Dietary restrictions (optional)"
          value={dietaryRestrictions}
          onChange={(e) => setDietaryRestrictions(e.target.value)}
        />
        <button onClick={handleGenerateRecipe} disabled={loading}>
          {loading ? "Generating..." : "Generate Recipe"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {generatedRecipe && (
        <div className="recipe-result">
          <h2>{generatedRecipe.title}</h2>
          <h3>Ingredients:</h3>
          <ul>
            {generatedRecipe.ingredients.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <h3>Instructions:</h3>
          <p>{generatedRecipe.instructions}</p>
        </div>
      )}
    </div>
  );
}

export default App;
