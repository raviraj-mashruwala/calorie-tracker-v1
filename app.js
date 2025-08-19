// CalorieTracker Pro - Enhanced with Custom Food Autocomplete
// Import Firebase functions
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

class CalorieTracker {
  constructor() {
    // Application state
    this.currentProfile = null;
    this.currentDate = new Date().toISOString().split("T")[0];
    this.charts = {};
    this.editingId = null;
    this.selectedIngredients = []; // For custom food builder
    this.foodDatabase = []; // Combined food database for autocomplete
    this.currentUser = null;

    // Static data from provided JSON
    this.commonFoods = [
      { name: "Apple (medium)", calories: 95, unit: "piece", servingSize: 1 },
      { name: "Banana (medium)", calories: 105, unit: "piece", servingSize: 1 },
      {
        name: "White Rice (cooked)",
        calories: 206,
        unit: "cup",
        servingSize: 1,
      },
      {
        name: "Chicken Breast (cooked)",
        calories: 231,
        unit: "100g",
        servingSize: 100,
      },
      {
        name: "Bread (white slice)",
        calories: 79,
        unit: "slice",
        servingSize: 1,
      },
      { name: "Egg (large)", calories: 78, unit: "piece", servingSize: 1 },
      { name: "Milk (1 cup)", calories: 149, unit: "cup", servingSize: 1 },
      { name: "Greek Yogurt", calories: 100, unit: "100g", servingSize: 100 },
      { name: "Almonds", calories: 576, unit: "100g", servingSize: 100 },
      { name: "Avocado", calories: 234, unit: "piece", servingSize: 1 },
    ];

    this.commonExercises = [
      { name: "Walking (moderate)", met: 3.5 },
      { name: "Running (6 mph)", met: 9.8 },
      { name: "Cycling (moderate)", met: 8.0 },
      { name: "Swimming", met: 8.3 },
      { name: "Weight Training", met: 6.0 },
      { name: "Yoga", met: 2.5 },
      { name: "Basketball", met: 8.0 },
      { name: "Tennis", met: 7.3 },
    ];

    this.activityMultipliers = {
      Sedentary: 1.2,
      "Lightly active": 1.375,
      "Moderately active": 1.55,
      "Very active": 1.725,
      "Super active": 1.9,
    };

    // Initialize data structure
    this.data = {
      profiles: [],
      currentProfileId: null,
      foodEntries: {},
      exerciseEntries: {},
      ingredients: [],
      customFoods: [],
    };

    // Setup auth listener FIRST
    this.setupAuthListener();

    // Initialize the application
    this.init();
  }

  // Initialize the application
  init() {
    this.setupEventListeners();
    this.populateSelects();
    this.setCurrentDates();
    this.loadCurrentProfile();
    this.loadFoodDatabase();
    this.updateUI();
    console.log("CalorieTracker Pro initialized successfully");
  }

  // Setup authentication listener
  setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        this.showApp();
        await this.loadAllDataFromFirestore();
      } else {
        this.currentUser = null;
        this.showAuth();
      }
    });
  }

  // Show authentication UI
  showAuth() {
    document.getElementById("authContainer").style.display = "block";
    document.getElementById("appContainer").style.display = "none";
  }

  // Show main app
  showApp() {
    document.getElementById("authContainer").style.display = "none";
    document.getElementById("appContainer").style.display = "block";
  }

  // Sign up user
  async signUp(email, password) {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      this.showAuthMessage("Account created successfully!", "success");
    } catch (error) {
      this.showAuthMessage("Sign-up error: " + error.message, "error");
    }
  }

  // Sign in user
  async signIn(email, password) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      this.showAuthMessage("Signed in successfully!", "success");
    } catch (error) {
      this.showAuthMessage("Sign-in error: " + error.message, "error");
    }
  }

  // Sign out user
  async signOutUser() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign-out error:", error);
    }
  }

  // Show auth messages
  showAuthMessage(message, type) {
    const errorDiv = document.getElementById("authError");
    errorDiv.textContent = message;
    errorDiv.className = `status status--${type}`;
    errorDiv.style.display = "block";
    setTimeout(() => {
      errorDiv.style.display = "none";
    }, 5000);
  }

  // Load all user data from Firestore
  async loadAllDataFromFirestore() {
    if (!this.currentUser) return;

    try {
      const userDoc = doc(db, "users", this.currentUser.uid);
      const userSnapshot = await getDoc(userDoc);

      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        this.data = {
          profiles: userData.profiles || [],
          currentProfileId: userData.currentProfileId || null,
          foodEntries: userData.foodEntries || {},
          exerciseEntries: userData.exerciseEntries || {},
          ingredients: userData.ingredients || [],
          customFoods: userData.customFoods || [],
        };
      } else {
        // Initialize empty data structure for new user
        this.data = {
          profiles: [],
          currentProfileId: null,
          foodEntries: {},
          exerciseEntries: {},
          ingredients: [],
          customFoods: [],
        };
        await this.saveAllDataToFirestore();
      }

      this.loadCurrentProfile();
      this.loadFoodDatabase();
      this.updateUI();
    } catch (error) {
      console.error("Error loading data from Firestore:", error);
      this.showAuthMessage(
        "Error loading your data. Please try again.",
        "error"
      );
    }
  }

  // Save all user data to Firestore
  async saveAllDataToFirestore() {
    if (!this.currentUser) return;

    try {
      const userDoc = doc(db, "users", this.currentUser.uid);
      const dataToSave = {
        ...this.data,
        updatedAt: new Date(),
      };
      await setDoc(userDoc, dataToSave, { merge: true });
    } catch (error) {
      console.error("Error saving data to Firestore:", error);
      this.showAuthMessage(
        "Error saving your data. Please try again.",
        "error"
      );
    }
  }

  // Load and merge food database for autocomplete
  loadFoodDatabase() {
    // Merge common foods and custom foods
    this.foodDatabase = [
      ...this.commonFoods.map((food) => ({
        id: "common_" + food.name.replace(/\s+/g, "_").toLowerCase(),
        name: food.name,
        calories: food.calories,
        unit: food.unit,
        servingSize: food.servingSize || 1,
        isCustom: false,
      })),
      ...this.data.customFoods.map((food) => ({
        ...food,
        isCustom: true,
      })),
    ];
  }

  // Check if food name already exists in database
  isDuplicateFood(name) {
    return this.foodDatabase.some(
      (food) => food.name.toLowerCase() === name.toLowerCase()
    );
  }

  // Setup all event listeners
  setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.showTab(e.target.dataset.tab);
      });
    });

    // Profile management
    document
      .getElementById("profileSelector")
      .addEventListener("change", (e) => {
        this.switchProfile(e.target.value);
      });

    document
      .getElementById("createProfileBtn")
      .addEventListener("click", () => {
        this.showProfileModal();
      });

    document.getElementById("addProfileBtn").addEventListener("click", () => {
      this.showProfileModal();
    });

    document
      .getElementById("profileForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.saveProfile();
      });

    document
      .getElementById("cancelProfileBtn")
      .addEventListener("click", () => {
        this.hideModal("profileModal");
      });

    // Enhanced food management with autocomplete
    document.getElementById("addFoodBtn").addEventListener("click", () => {
      this.showFoodModal();
    });

    document.getElementById("quickAddFoodBtn").addEventListener("click", () => {
      this.showFoodModal();
    });

    // Food Form
    document
      .getElementById("foodForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.saveFoodEntry();
      });

    document.getElementById("cancelFoodBtn").addEventListener("click", () => {
      this.hideModal("foodModal");
    });

    document.getElementById("foodDate").addEventListener("change", (e) => {
      this.currentDate = e.target.value;
      this.renderFoodEntries();
      this.updateDashboard();
    });

    // Custom food builder
    document.getElementById("buildFoodBtn").addEventListener("click", () => {
      this.showFoodBuilderModal();
    });

    document
      .getElementById("quickBuildFoodBtn")
      .addEventListener("click", () => {
        this.showFoodBuilderModal();
      });

    // Food Builder Form
    document
      .getElementById("foodBuilderForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.saveCustomFood();
      });

    document
      .getElementById("cancelFoodBuilderBtn")
      .addEventListener("click", () => {
        this.hideModal("foodBuilderModal");
      });

    document
      .getElementById("addIngredientToFood")
      .addEventListener("click", () => {
        this.addIngredientToFood();
      });

    // Exercise management
    document.getElementById("addExerciseBtn").addEventListener("click", () => {
      this.showExerciseModal();
    });

    document
      .getElementById("quickAddExerciseBtn")
      .addEventListener("click", () => {
        this.showExerciseModal();
      });

    // Exercise Form
    document
      .getElementById("exerciseForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.saveExerciseEntry();
      });

    document
      .getElementById("cancelExerciseBtn")
      .addEventListener("click", () => {
        this.hideModal("exerciseModal");
      });

    document
      .getElementById("exerciseSelect")
      .addEventListener("change", (e) => {
        this.handleExerciseSelection(e.target.value);
      });

    document.getElementById("exerciseDate").addEventListener("change", (e) => {
      this.currentDate = e.target.value;
      this.renderExerciseEntries();
      this.updateDashboard();
    });

    // Enhanced ingredient management
    document
      .getElementById("addIngredientBtn")
      .addEventListener("click", () => {
        this.showIngredientModal();
      });

    // Ingredient Form
    document
      .getElementById("ingredientForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.saveIngredient();
      });

    document
      .getElementById("cancelIngredientBtn")
      .addEventListener("click", () => {
        this.hideModal("ingredientModal");
      });

    // Base unit selection
    document.querySelectorAll('input[name="baseUnit"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.updateBaseUnitDisplay(e.target.value);
      });
    });

    // Summary tabs
    document.querySelectorAll(".summary-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.showSummaryTab(e.target.dataset.summary);
      });
    });

    document.getElementById("summaryDate").addEventListener("change", (e) => {
      this.updateSummaryCharts("daily");
    });

    // Modal close on backdrop click
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.hideModal(modal.id);
        }
      });
    });

    // Authentication
    document.getElementById("signUpBtn").addEventListener("click", () => {
      const email = document.getElementById("emailInput").value;
      const password = document.getElementById("passwordInput").value;
      this.signUp(email, password);
    });

    document.getElementById("signInBtn").addEventListener("click", () => {
      const email = document.getElementById("emailInput").value;
      const password = document.getElementById("passwordInput").value;
      this.signIn(email, password);
    });

    document.getElementById("signOutBtn").addEventListener("click", () => {
      this.signOutUser();
    });
  }

  // Setup autocomplete functionality
  setupAutocomplete() {
    const input = document.getElementById("foodNameInput");
    const suggestions = document.getElementById("suggestions");
    let selectedIndex = -1;

    // Clear previous listeners
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    // Add event listeners to the new input
    document.getElementById("foodNameInput").addEventListener("input", (e) => {
      const value = e.target.value.trim();
      this.showSuggestions(value);
      selectedIndex = -1;
    });

    document
      .getElementById("foodNameInput")
      .addEventListener("keydown", (e) => {
        const suggestionItems =
          suggestions.querySelectorAll(".autocomplete-item");

        if (e.key === "ArrowDown") {
          e.preventDefault();
          selectedIndex = Math.min(
            selectedIndex + 1,
            suggestionItems.length - 1
          );
          this.updateSelectedSuggestion(suggestionItems, selectedIndex);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          this.updateSelectedSuggestion(suggestionItems, selectedIndex);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (selectedIndex >= 0 && suggestionItems[selectedIndex]) {
            this.selectSuggestion(
              JSON.parse(suggestionItems[selectedIndex].dataset.food)
            );
          }
        } else if (e.key === "Escape") {
          this.hideSuggestions();
        }
      });

    // Hide suggestions when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".food-entry")) {
        this.hideSuggestions();
      }
    });
  }

  // Show autocomplete suggestions
  showSuggestions(query) {
    const suggestions = document.getElementById("suggestions");

    if (query.length < 1) {
      this.hideSuggestions();
      return;
    }

    const matches = this.foodDatabase
      .filter((food) => food.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8); // Limit to 8 suggestions

    if (matches.length === 0) {
      this.hideSuggestions();
      return;
    }

    suggestions.innerHTML = "";
    suggestions.classList.remove("hidden");

    matches.forEach((food) => {
      const div = document.createElement("div");
      div.className = "autocomplete-item";
      div.dataset.food = JSON.stringify(food);
      div.innerHTML = `
                <div class="autocomplete-item-name">${food.name}</div>
                <div class="autocomplete-item-details">${food.calories} kcal per ${food.unit}</div>
            `;
      div.addEventListener("click", () => this.selectSuggestion(food));
      suggestions.appendChild(div);
    });
  }

  // Update selected suggestion highlight
  updateSelectedSuggestion(items, selectedIndex) {
    items.forEach((item, index) => {
      item.classList.toggle("active", index === selectedIndex);
    });
  }

  // Select a suggestion
  selectSuggestion(food) {
    document.getElementById("foodNameInput").value = food.name;
    document.getElementById("servingSize").value = food.servingSize || 1;
    document.getElementById("servingUnit").value = food.unit;
    document.getElementById("caloriesPerServing").value = food.calories;
    this.hideSuggestions();
  }

  // Hide suggestions
  hideSuggestions() {
    document.getElementById("suggestions").classList.add("hidden");
  }

  // Enhanced ingredient management
  updateBaseUnitDisplay(baseUnit) {
    const display = document.getElementById("baseUnitDisplay");
    display.textContent = baseUnit === "100ml" ? "per 100ml" : "per 100g";
  }

  showIngredientModal(ingredient = null) {
    const modal = document.getElementById("ingredientModal");
    const form = document.getElementById("ingredientForm");
    const title = document.getElementById("ingredientModalTitle");

    this.editingId = null;

    if (ingredient) {
      title.textContent = "Edit Ingredient";
      this.editingId = ingredient.id;
      document.getElementById("ingredientName").value = ingredient.name;
      document.getElementById("ingredientCategory").value = ingredient.category;
      document.getElementById("ingredientCalories").value = ingredient.calories;

      // Set base unit radio button
      const baseUnit = ingredient.baseUnit || "100g";
      document.querySelector(
        `input[name="baseUnit"][value="${baseUnit}"]`
      ).checked = true;
      this.updateBaseUnitDisplay(baseUnit);

      // Set optional nutritional values
      document.getElementById("ingredientProtein").value =
        ingredient.protein || "";
      document.getElementById("ingredientCarbs").value = ingredient.carbs || "";
      document.getElementById("ingredientFat").value = ingredient.fat || "";
    } else {
      title.textContent = "Add Ingredient";
      form.reset();
      document.querySelector(
        'input[name="baseUnit"][value="100g"]'
      ).checked = true;
      this.updateBaseUnitDisplay("100g");
    }

    modal.classList.remove("hidden");
  }

  async saveIngredient() {
    const form = document.getElementById("ingredientForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const baseUnit = document.querySelector(
      'input[name="baseUnit"]:checked'
    ).value;

    const ingredientData = {
      id: this.editingId || "ingredient_" + Date.now(),
      name: document.getElementById("ingredientName").value.trim(),
      category: document.getElementById("ingredientCategory").value,
      calories: parseInt(document.getElementById("ingredientCalories").value),
      baseUnit: baseUnit,
      protein:
        parseFloat(document.getElementById("ingredientProtein").value) || null,
      carbs:
        parseFloat(document.getElementById("ingredientCarbs").value) || null,
      fat: parseFloat(document.getElementById("ingredientFat").value) || null,
      createdAt: this.editingId
        ? this.data.ingredients.find((i) => i.id === this.editingId)
            ?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    };

    if (this.editingId) {
      const index = this.data.ingredients.findIndex(
        (i) => i.id === this.editingId
      );
      if (index !== -1) {
        this.data.ingredients[index] = ingredientData;
      }
    } else {
      this.data.ingredients.push(ingredientData);
    }

    await this.saveAllDataToFirestore();
    this.renderIngredients();
    this.hideModal("ingredientModal");
    console.log("Ingredient saved:", ingredientData.name);
  }

  async deleteIngredient(ingredientId) {
    if (!confirm("Are you sure you want to delete this ingredient?")) {
      return;
    }

    this.data.ingredients = this.data.ingredients.filter(
      (i) => i.id !== ingredientId
    );
    await this.saveAllDataToFirestore();
    this.renderIngredients();
    console.log("Ingredient deleted");
  }

  renderIngredients() {
    const container = document.getElementById("ingredientsGrid");
    container.innerHTML = "";

    if (this.data.ingredients.length === 0) {
      const div = document.createElement("div");
      div.className = "empty-state";
      div.style.gridColumn = "1 / -1";
      div.innerHTML = "<p>No custom ingredients added yet</p>";
      container.appendChild(div);
      return;
    }

    this.data.ingredients.forEach((ingredient) => {
      const div = document.createElement("div");
      div.className = "ingredient-card";
      div.innerHTML = `
                <div class="ingredient-header">
                    <div class="ingredient-name">${ingredient.name}</div>
                    <div class="ingredient-category">${
                      ingredient.category
                    }</div>
                </div>
                <div class="ingredient-info">
                    ${ingredient.calories} kcal ${ingredient.baseUnit}
                    <span class="ingredient-unit-badge">${
                      ingredient.baseUnit
                    }</span>
                </div>
                <div class="ingredient-actions">
                    <button class="btn btn--sm btn--secondary" onclick="app.showIngredientModal(${JSON.stringify(
                      ingredient
                    ).replace(/"/g, "&quot;")})">Edit</button>
                    <button class="btn btn--sm delete-btn" onclick="app.deleteIngredient('${
                      ingredient.id
                    }')">Delete</button>
                </div>
            `;
      container.appendChild(div);
    });
  }

  // Custom Food Builder
  showFoodBuilderModal() {
    if (!this.currentProfile) {
      alert("Please create and select a profile first.");
      return;
    }

    const modal = document.getElementById("foodBuilderModal");
    const form = document.getElementById("foodBuilderForm");
    form.reset();

    // Set default meal based on current time
    const hour = new Date().getHours();
    let defaultMeal = "Snack";
    if (hour >= 5 && hour < 11) defaultMeal = "Breakfast";
    else if (hour >= 11 && hour < 17) defaultMeal = "Lunch";
    else if (hour >= 17 && hour < 22) defaultMeal = "Dinner";

    document.getElementById("builderMealType").value = defaultMeal;

    // Reset selected ingredients
    this.selectedIngredients = [];
    this.updateSelectedIngredientsList();

    // Populate ingredient dropdown and setup event listeners
    this.populateIngredientSelect();
    this.setupFoodBuilderEventListeners();

    // Reset calculation display
    document.getElementById("ingredientCaloriesDisplay").textContent = "0 kcal";

    modal.classList.remove("hidden");
  }

  setupFoodBuilderEventListeners() {
    // Remove existing listeners to avoid duplicates
    const ingredientSelect = document.getElementById("ingredientSelect");
    const ingredientAmount = document.getElementById("ingredientAmount");

    // Clone elements to remove all event listeners
    const newIngredientSelect = ingredientSelect.cloneNode(true);
    const newIngredientAmount = ingredientAmount.cloneNode(true);

    ingredientSelect.parentNode.replaceChild(
      newIngredientSelect,
      ingredientSelect
    );
    ingredientAmount.parentNode.replaceChild(
      newIngredientAmount,
      ingredientAmount
    );

    // Add fresh event listeners
    document
      .getElementById("ingredientSelect")
      .addEventListener("change", () => {
        this.updateIngredientCalculation();
      });

    document
      .getElementById("ingredientAmount")
      .addEventListener("input", () => {
        this.updateIngredientCalculation();
      });
  }

  populateIngredientSelect() {
    const select = document.getElementById("ingredientSelect");
    select.innerHTML = '<option value="">Select ingredient</option>';

    // Add custom ingredients first
    this.data.ingredients.forEach((ingredient) => {
      const option = document.createElement("option");
      option.value = JSON.stringify(ingredient);
      option.textContent = `${ingredient.name} (${ingredient.calories} kcal ${ingredient.baseUnit})`;
      select.appendChild(option);
    });

    // Add common foods as ingredients if they have 100g/100ml units
    this.commonFoods.forEach((food) => {
      if (food.unit === "100g") {
        const ingredient = {
          id: "common_" + food.name.replace(/\s+/g, "_").toLowerCase(),
          name: food.name,
          calories: food.calories,
          baseUnit: "100g",
          category: "Common Foods",
        };
        const option = document.createElement("option");
        option.value = JSON.stringify(ingredient);
        option.textContent = `${ingredient.name} (${ingredient.calories} kcal ${ingredient.baseUnit})`;
        select.appendChild(option);
      }
    });
  }

  updateIngredientCalculation() {
    const ingredientSelect = document.getElementById("ingredientSelect");
    const amountInput = document.getElementById("ingredientAmount");
    const unitSelect = document.getElementById("ingredientUnit");
    const caloriesDisplay = document.getElementById(
      "ingredientCaloriesDisplay"
    );

    if (!ingredientSelect.value || !amountInput.value) {
      caloriesDisplay.textContent = "0 kcal";
      return;
    }

    try {
      const ingredient = JSON.parse(ingredientSelect.value);
      const amount = parseFloat(amountInput.value);

      if (isNaN(amount) || amount <= 0) {
        caloriesDisplay.textContent = "0 kcal";
        return;
      }

      // Update unit selector based on ingredient base unit
      const baseUnit = ingredient.baseUnit || "100g";
      if (baseUnit === "100ml") {
        unitSelect.innerHTML = '<option value="ml">ml</option>';
        unitSelect.value = "ml";
      } else {
        unitSelect.innerHTML = '<option value="g">g</option>';
        unitSelect.value = "g";
      }

      // Calculate proportional calories
      const calories = this.calculateProportionalCalories(ingredient, amount);
      caloriesDisplay.textContent = `${calories.toFixed(1)} kcal`;
    } catch (e) {
      console.error("Error calculating calories:", e);
      caloriesDisplay.textContent = "0 kcal";
    }
  }

  calculateProportionalCalories(ingredient, amount) {
    // Formula: (stored_calories_per_100x × amount_used) ÷ 100 = calculated_calories
    const baseCalories = ingredient.calories;
    return (baseCalories * amount) / 100;
  }

  addIngredientToFood() {
    const ingredientSelect = document.getElementById("ingredientSelect");
    const amountInput = document.getElementById("ingredientAmount");
    const unitSelect = document.getElementById("ingredientUnit");

    if (!ingredientSelect.value || !amountInput.value) {
      alert("Please select an ingredient and enter an amount.");
      return;
    }

    try {
      const ingredient = JSON.parse(ingredientSelect.value);
      const amount = parseFloat(amountInput.value);
      const unit = unitSelect.value;

      if (amount <= 0) {
        alert("Please enter a valid amount greater than 0.");
        return;
      }

      const calories = this.calculateProportionalCalories(ingredient, amount);

      const selectedIngredient = {
        id: "selected_" + Date.now(),
        ingredient: ingredient,
        amount: amount,
        unit: unit,
        calories: calories,
      };

      this.selectedIngredients.push(selectedIngredient);
      this.updateSelectedIngredientsList();

      // Reset form
      ingredientSelect.value = "";
      amountInput.value = "";
      document.getElementById("ingredientCaloriesDisplay").textContent =
        "0 kcal";

      console.log("Ingredient added to food:", ingredient.name, amount, unit);
    } catch (e) {
      console.error("Error adding ingredient:", e);
      alert("Error adding ingredient. Please try again.");
    }
  }

  removeIngredientFromFood(selectedId) {
    this.selectedIngredients = this.selectedIngredients.filter(
      (item) => item.id !== selectedId
    );
    this.updateSelectedIngredientsList();
  }

  updateSelectedIngredientsList() {
    const container = document.getElementById("selectedIngredientsList");
    const totalDisplay = document.getElementById("totalFoodCalories");

    container.innerHTML = "";
    let totalCalories = 0;

    if (this.selectedIngredients.length === 0) {
      const div = document.createElement("div");
      div.className = "empty-state";
      div.textContent = "No ingredients added yet";
      container.appendChild(div);
    } else {
      this.selectedIngredients.forEach((item) => {
        totalCalories += item.calories;

        const div = document.createElement("div");
        div.className = "selected-ingredient-item";
        div.innerHTML = `
                    <div class="selected-ingredient-info">
                        <div class="selected-ingredient-name">${
                          item.ingredient.name
                        }</div>
                        <div class="selected-ingredient-amount">${item.amount}${
          item.unit
        } = ${item.calories.toFixed(1)} kcal</div>
                    </div>
                    <button class="btn btn--sm delete-btn" onclick="app.removeIngredientFromFood('${
                      item.id
                    }')">Remove</button>
                `;
        container.appendChild(div);
      });
    }

    totalDisplay.textContent = totalCalories.toFixed(1);
  }

  async saveCustomFood() {
    if (!this.currentProfile) return;

    const form = document.getElementById("foodBuilderForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (this.selectedIngredients.length === 0) {
      alert("Please add at least one ingredient to your custom food.");
      return;
    }

    const customFoodName = document
      .getElementById("customFoodName")
      .value.trim();
    const mealType = document.getElementById("builderMealType").value;
    const totalCalories = this.selectedIngredients.reduce(
      (sum, item) => sum + item.calories,
      0
    );

    const entry = {
      id: "food_" + Date.now(),
      name: customFoodName,
      meal: mealType,
      quantity: 1,
      caloriesPerUnit: Math.round(totalCalories),
      totalCalories: Math.round(totalCalories),
      date: this.currentDate,
      timestamp: new Date().toISOString(),
      isCustomFood: true,
      ingredients: this.selectedIngredients.map((item) => ({
        name: item.ingredient.name,
        amount: item.amount,
        unit: item.unit,
        calories: item.calories,
      })),
    };

    const profileId = this.currentProfile.id;
    if (!this.data.foodEntries[profileId]) {
      this.data.foodEntries[profileId] = {};
    }
    if (!this.data.foodEntries[profileId][this.currentDate]) {
      this.data.foodEntries[profileId][this.currentDate] = [];
    }

    this.data.foodEntries[profileId][this.currentDate].push(entry);
    await this.saveAllDataToFirestore();
    this.renderFoodEntries();
    this.updateDashboard();
    this.hideModal("foodBuilderModal");

    console.log("Custom food added:", customFoodName);
  }

  // Tab navigation
  showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll(".tab-content").forEach((tab) => {
      tab.classList.remove("active");
    });

    // Show selected tab
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
      targetTab.classList.add("active");
    }

    // Update nav buttons
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.add("active");
    }

    // Load tab-specific content
    this.loadTabContent(tabName);
  }

  // Load content for specific tabs
  loadTabContent(tabName) {
    switch (tabName) {
      case "food":
        this.renderFoodEntries();
        break;
      case "exercise":
        this.renderExerciseEntries();
        break;
      case "ingredients":
        this.renderIngredients();
        break;
      case "profiles":
        this.renderProfiles();
        break;
      case "summary":
        this.updateSummaryCharts("daily");
        break;
    }
  }

  // Profile Management
  loadCurrentProfile() {
    if (this.data.currentProfileId) {
      this.currentProfile = this.data.profiles.find(
        (p) => p.id === this.data.currentProfileId
      );
    }
    this.updateProfileSelector();
  }

  updateProfileSelector() {
    const selector = document.getElementById("profileSelector");
    selector.innerHTML = '<option value="">Select Profile</option>';

    this.data.profiles.forEach((profile) => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      if (this.currentProfile && profile.id === this.currentProfile.id) {
        option.selected = true;
      }
      selector.appendChild(option);
    });
  }

  async switchProfile(profileId) {
    if (!profileId) {
      this.currentProfile = null;
      this.data.currentProfileId = null;
    } else {
      this.currentProfile = this.data.profiles.find((p) => p.id === profileId);
      this.data.currentProfileId = profileId;
    }

    await this.saveAllDataToFirestore();
    this.updateUI();
  }

  showProfileModal(profile = null) {
    const modal = document.getElementById("profileModal");
    const form = document.getElementById("profileForm");
    const title = document.getElementById("profileModalTitle");

    this.editingId = null;

    if (profile) {
      title.textContent = "Edit Profile";
      this.editingId = profile.id;
      document.getElementById("profileName").value = profile.name;
      document.getElementById("profileGender").value = profile.gender;
      document.getElementById("profileAge").value = profile.age;
      document.getElementById("profileWeight").value = profile.weight;
      document.getElementById("profileHeight").value = profile.height;
    } else {
      title.textContent = "Create Profile";
      form.reset();
    }

    modal.classList.remove("hidden");
  }

  async saveProfile() {
    const form = document.getElementById("profileForm");

    // Validate form
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const profileData = {
      id: this.editingId || "profile_" + Date.now(),
      name: document.getElementById("profileName").value.trim(),
      gender: document.getElementById("profileGender").value,
      age: parseInt(document.getElementById("profileAge").value),
      weight: parseFloat(document.getElementById("profileWeight").value),
      height: parseInt(document.getElementById("profileHeight").value),
      createdAt: this.editingId
        ? this.data.profiles.find((p) => p.id === this.editingId)?.createdAt ||
          new Date().toISOString()
        : new Date().toISOString(),
    };

    if (this.editingId) {
      const index = this.data.profiles.findIndex(
        (p) => p.id === this.editingId
      );
      if (index !== -1) {
        this.data.profiles[index] = profileData;
      }
    } else {
      this.data.profiles.push(profileData);
      this.currentProfile = profileData;
      this.data.currentProfileId = profileData.id;
    }

    await this.saveAllDataToFirestore();
    this.updateProfileSelector();
    this.renderProfiles();
    this.updateDashboard();
    this.hideModal("profileModal");

    console.log("Profile saved successfully:", profileData.name);
  }

  async deleteProfile(profileId) {
    if (
      !confirm(
        "Are you sure you want to delete this profile? All associated data will be lost."
      )
    ) {
      return;
    }

    this.data.profiles = this.data.profiles.filter((p) => p.id !== profileId);

    // Delete associated data
    if (this.data.foodEntries[profileId]) {
      delete this.data.foodEntries[profileId];
    }
    if (this.data.exerciseEntries[profileId]) {
      delete this.data.exerciseEntries[profileId];
    }

    if (this.currentProfile && this.currentProfile.id === profileId) {
      this.currentProfile = null;
      this.data.currentProfileId = null;
    }

    await this.saveAllDataToFirestore();
    this.updateUI();
    console.log("Profile deleted successfully");
  }

  // Calculations
  calculateBMR(profile) {
    if (!profile) return 0;

    const { gender, weight, height, age } = profile;

    if (gender === "male") {
      return 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      return 10 * weight + 6.25 * height - 5 * age - 161;
    }
  }

  calculateTDEE(profile) {
    if (!profile) return 0;

    const bmr = this.calculateBMR(profile);
    const multiplier = this.activityMultipliers[profile.activityLevel] || 1.2;
    return bmr * multiplier;
  }

  // Enhanced Food Management with Autocomplete
  populateSelects() {
    this.populateExerciseSelect();
  }

  populateExerciseSelect() {
    const exerciseSelect = document.getElementById("exerciseSelect");
    exerciseSelect.innerHTML =
      '<option value="">Select exercise</option><option value="custom">Custom exercise</option>';

    this.commonExercises.forEach((exercise) => {
      const option = document.createElement("option");
      option.value = JSON.stringify(exercise);
      option.textContent = exercise.name;
      exerciseSelect.appendChild(option);
    });
  }

  showFoodModal() {
    if (!this.currentProfile) {
      alert("Please create and select a profile first.");
      return;
    }

    const modal = document.getElementById("foodModal");
    const form = document.getElementById("foodForm");
    form.reset();

    // Set default meal based on current time
    const hour = new Date().getHours();
    let defaultMeal = "Snack";
    if (hour >= 5 && hour < 11) defaultMeal = "Breakfast";
    else if (hour >= 11 && hour < 17) defaultMeal = "Lunch";
    else if (hour >= 17 && hour < 22) defaultMeal = "Dinner";

    document.getElementById("mealType").value = defaultMeal;
    document.getElementById("servingSize").value = "1";
    document.getElementById("servingUnit").value = "piece";
    document.getElementById("foodNameInput").value = "";
    document.getElementById("caloriesPerServing").value = "";

    this.hideSuggestions();
    modal.classList.remove("hidden");

    // Setup autocomplete after modal is shown
    setTimeout(() => this.setupAutocomplete(), 100);
  }

  async saveFoodEntry() {
    if (!this.currentProfile) return;

    const form = document.getElementById("foodForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const foodName = document.getElementById("foodNameInput").value.trim();
    const mealType = document.getElementById("mealType").value;
    const servingSize = parseFloat(
      document.getElementById("servingSize").value
    );
    const servingUnit = document.getElementById("servingUnit").value;
    const caloriesPerServing = parseInt(
      document.getElementById("caloriesPerServing").value
    );

    if (!foodName || !servingSize || !caloriesPerServing) {
      alert("Please fill in all required fields.");
      return;
    }

    // Check if this is a new food item
    if (!this.isDuplicateFood(foodName)) {
      const shouldSave = confirm(
        `"${foodName}" is not in our database. Would you like to save it for future use?`
      );
      if (shouldSave) {
        const customFood = {
          id: "custom_" + Date.now(),
          name: foodName,
          calories: caloriesPerServing,
          unit: servingUnit,
          servingSize: servingSize,
          createdAt: new Date().toISOString(),
        };

        this.data.customFoods.push(customFood);
        this.loadFoodDatabase(); // Refresh the database
        await this.saveAllDataToFirestore();
        console.log("New food saved to database:", foodName);
      }
    }

    const totalCalories = Math.round(servingSize * caloriesPerServing);

    const entry = {
      id: "food_" + Date.now(),
      name: foodName,
      meal: mealType,
      quantity: servingSize,
      unit: servingUnit,
      caloriesPerUnit: caloriesPerServing,
      totalCalories: totalCalories,
      date: this.currentDate,
      timestamp: new Date().toISOString(),
      isCustomFood: false,
    };

    const profileId = this.currentProfile.id;
    if (!this.data.foodEntries[profileId]) {
      this.data.foodEntries[profileId] = {};
    }
    if (!this.data.foodEntries[profileId][this.currentDate]) {
      this.data.foodEntries[profileId][this.currentDate] = [];
    }

    this.data.foodEntries[profileId][this.currentDate].push(entry);
    await this.saveAllDataToFirestore();
    this.renderFoodEntries();
    this.updateDashboard();
    this.hideModal("foodModal");

    console.log("Food entry added:", foodName);
  }

  async deleteFoodEntry(entryId) {
    if (!this.currentProfile) return;

    const profileId = this.currentProfile.id;
    if (
      this.data.foodEntries[profileId] &&
      this.data.foodEntries[profileId][this.currentDate]
    ) {
      this.data.foodEntries[profileId][this.currentDate] =
        this.data.foodEntries[profileId][this.currentDate].filter(
          (entry) => entry.id !== entryId
        );
      await this.saveAllDataToFirestore();
      this.renderFoodEntries();
      this.updateDashboard();
      console.log("Food entry deleted");
    }
  }

  renderFoodEntries() {
    const mealTypes = ["breakfast", "lunch", "dinner", "snack"];

    mealTypes.forEach((mealType) => {
      const container = document.getElementById(`${mealType}Items`);
      const totalElement = document.getElementById(`${mealType}Total`);

      container.innerHTML = "";
      let mealTotal = 0;

      if (
        this.currentProfile &&
        this.data.foodEntries[this.currentProfile.id] &&
        this.data.foodEntries[this.currentProfile.id][this.currentDate]
      ) {
        const mealName = mealType.charAt(0).toUpperCase() + mealType.slice(1);
        const entries = this.data.foodEntries[this.currentProfile.id][
          this.currentDate
        ].filter(
          (entry) =>
            entry.meal === mealName ||
            (mealType === "snack" && entry.meal === "Snack")
        );

        entries.forEach((entry) => {
          mealTotal += entry.totalCalories;

          const div = document.createElement("div");
          div.className = "meal-item";

          let detailsText;
          if (entry.isCustomFood && entry.ingredients) {
            detailsText =
              "Custom recipe: " +
              entry.ingredients
                .map((ing) => `${ing.amount}${ing.unit} ${ing.name}`)
                .join(", ");
          } else {
            detailsText = `${entry.quantity} ${entry.unit || ""} × ${
              entry.caloriesPerUnit
            } kcal`.trim();
          }

          div.innerHTML = `
                        <div class="meal-item-info">
                            <div class="meal-item-name">${entry.name}</div>
                            <div class="meal-item-details">${detailsText}</div>
                        </div>
                        <div class="meal-item-calories">${entry.totalCalories} kcal</div>
                        <div class="meal-item-actions">
                            <button class="btn btn--sm delete-btn" onclick="app.deleteFoodEntry('${entry.id}')">Delete</button>
                        </div>
                    `;
          container.appendChild(div);
        });
      }

      if (mealTotal === 0) {
        const div = document.createElement("div");
        div.className = "empty-state";
        div.textContent = `No ${
          mealType === "snack" ? "snacks" : mealType
        } items logged`;
        container.appendChild(div);
      }

      if (totalElement) {
        totalElement.textContent = `${mealTotal} kcal`;
      }
    });
  }

  // Exercise Management
  showExerciseModal() {
    if (!this.currentProfile) {
      alert("Please create and select a profile first.");
      return;
    }

    const modal = document.getElementById("exerciseModal");
    const form = document.getElementById("exerciseForm");
    form.reset();
    document.getElementById("customExercise").classList.add("hidden");

    modal.classList.remove("hidden");
  }

  handleExerciseSelection(value) {
    const customExercise = document.getElementById("customExercise");

    if (value === "custom") {
      customExercise.classList.remove("hidden");
      customExercise.required = true;
    } else {
      customExercise.classList.add("hidden");
      customExercise.required = false;
    }
  }

  async saveExerciseEntry() {
    if (!this.currentProfile) return;

    const form = document.getElementById("exerciseForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const exerciseSelect = document.getElementById("exerciseSelect");
    const customExercise = document.getElementById("customExercise");
    const duration = parseInt(
      document.getElementById("exerciseDuration").value
    );
    const manualCalories = document.getElementById("exerciseCalories").value;

    let exerciseName = "";
    let met = 0;

    if (exerciseSelect.value === "custom") {
      exerciseName = customExercise.value.trim();
    } else if (exerciseSelect.value) {
      try {
        const exercise = JSON.parse(exerciseSelect.value);
        exerciseName = exercise.name;
        met = exercise.met;
      } catch (e) {
        exerciseName = "Unknown exercise";
      }
    } else {
      alert("Please select an exercise.");
      return;
    }

    if (!exerciseName || !duration) {
      alert("Please fill in all required fields.");
      return;
    }

    // Calculate calories burned
    let caloriesBurned;
    if (manualCalories) {
      caloriesBurned = parseInt(manualCalories);
    } else if (met > 0) {
      // METs formula: calories = METs * weight(kg) * time(hours)
      caloriesBurned = Math.round(
        met * this.currentProfile.weight * (duration / 60)
      );
    } else {
      // Default estimation
      caloriesBurned = Math.round(duration * 5);
    }

    const entry = {
      id: "exercise_" + Date.now(),
      name: exerciseName,
      duration: duration,
      caloriesBurned: caloriesBurned,
      met: met,
      date: this.currentDate,
      timestamp: new Date().toISOString(),
    };

    const profileId = this.currentProfile.id;
    if (!this.data.exerciseEntries[profileId]) {
      this.data.exerciseEntries[profileId] = {};
    }
    if (!this.data.exerciseEntries[profileId][this.currentDate]) {
      this.data.exerciseEntries[profileId][this.currentDate] = [];
    }

    this.data.exerciseEntries[profileId][this.currentDate].push(entry);
    await this.saveAllDataToFirestore();
    this.renderExerciseEntries();
    this.updateDashboard();
    this.hideModal("exerciseModal");

    console.log("Exercise entry added:", exerciseName);
  }

  async deleteExerciseEntry(entryId) {
    if (!this.currentProfile) return;

    const profileId = this.currentProfile.id;
    if (
      this.data.exerciseEntries[profileId] &&
      this.data.exerciseEntries[profileId][this.currentDate]
    ) {
      this.data.exerciseEntries[profileId][this.currentDate] =
        this.data.exerciseEntries[profileId][this.currentDate].filter(
          (entry) => entry.id !== entryId
        );
      await this.saveAllDataToFirestore();
      this.renderExerciseEntries();
      this.updateDashboard();
      console.log("Exercise entry deleted");
    }
  }

  renderExerciseEntries() {
    const container = document.getElementById("exerciseList");
    const totalElement = document.getElementById("totalBurned");

    container.innerHTML = "";
    let totalBurned = 0;

    if (
      this.currentProfile &&
      this.data.exerciseEntries[this.currentProfile.id] &&
      this.data.exerciseEntries[this.currentProfile.id][this.currentDate]
    ) {
      const entries =
        this.data.exerciseEntries[this.currentProfile.id][this.currentDate];

      entries.forEach((entry) => {
        totalBurned += entry.caloriesBurned;

        const div = document.createElement("div");
        div.className = "exercise-item";
        div.innerHTML = `
                    <div class="exercise-info">
                        <h4>${entry.name}</h4>
                        <div class="exercise-details">${entry.duration} minutes</div>
                    </div>
                    <div class="exercise-calories">${entry.caloriesBurned} kcal</div>
                    <div class="exercise-actions">
                        <button class="btn btn--sm delete-btn" onclick="app.deleteExerciseEntry('${entry.id}')">Delete</button>
                    </div>
                `;
        container.appendChild(div);
      });
    }

    if (totalBurned === 0) {
      const div = document.createElement("div");
      div.className = "empty-state";
      div.textContent = "No exercises logged today";
      container.appendChild(div);
    }

    totalElement.textContent = totalBurned;
  }

  // Profile rendering
  renderProfiles() {
    const container = document.getElementById("profilesGrid");
    container.innerHTML = "";

    if (this.data.profiles.length === 0) {
      const div = document.createElement("div");
      div.className = "empty-state";
      div.style.gridColumn = "1 / -1";
      div.innerHTML = "<p>No profiles created yet</p>";
      container.appendChild(div);
      return;
    }

    this.data.profiles.forEach((profile) => {
      const isActive =
        this.currentProfile && profile.id === this.currentProfile.id;
      const bmr = Math.round(this.calculateBMR(profile));
      const tdee = Math.round(this.calculateTDEE(profile));

      const div = document.createElement("div");
      div.className = `profile-card ${isActive ? "active" : ""}`;
      div.innerHTML = `
                <div class="profile-header">
                    <div class="profile-name">${profile.name}</div>
                    ${
                      isActive
                        ? '<div class="profile-active-badge">Active</div>'
                        : ""
                    }
                </div>
                <div class="profile-details">
                    <div class="profile-detail">
                        <span class="profile-detail-label">Age</span>
                        <span class="profile-detail-value">${
                          profile.age
                        } years</span>
                    </div>
                    <div class="profile-detail">
                        <span class="profile-detail-label">Weight</span>
                        <span class="profile-detail-value">${
                          profile.weight
                        } kg</span>
                    </div>
                    <div class="profile-detail">
                        <span class="profile-detail-label">Height</span>
                        <span class="profile-detail-value">${
                          profile.height
                        } cm</span>
                    </div>
                    <div class="profile-detail">
                        <span class="profile-detail-label">Gender</span>
                        <span class="profile-detail-value">${
                          profile.gender
                        }</span>
                    </div>
                    <div class="profile-detail">
                        <span class="profile-detail-label">BMR</span>
                        <span class="profile-detail-value">${bmr} kcal</span>
                    </div>
                </div>
                <div class="profile-actions">
                    ${
                      !isActive
                        ? `<button class="btn btn--sm btn--primary" onclick="app.switchProfile('${profile.id}')">Select</button>`
                        : ""
                    }
                    <button class="btn btn--sm btn--secondary" onclick="app.showProfileModal(${JSON.stringify(
                      profile
                    ).replace(/"/g, "&quot;")})">Edit</button>
                    <button class="btn btn--sm delete-btn" onclick="app.deleteProfile('${
                      profile.id
                    }')">Delete</button>
                </div>
            `;
      container.appendChild(div);
    });
  }

  // Dashboard and calculations
  updateDashboard() {
    if (!this.currentProfile) {
      document.getElementById("bmrValue").textContent = "--";
      /* document.getElementById('tdeeValue').textContent = '--'; */
      document.getElementById("consumedValue").textContent = "0";
      document.getElementById("burnedValue").textContent = "0";
      document.getElementById("netValue").textContent = "0";
      /* document.getElementById('progressText').textContent = '0% of TDEE';
            document.getElementById('calorieProgress').style.width = '0%'; */
      return;
    }

    const bmr = Math.round(this.calculateBMR(this.currentProfile));
    /* const tdee = Math.round(this.calculateTDEE(this.currentProfile)); */
    const consumed = this.getTotalCaloriesConsumed(
      this.currentProfile.id,
      this.currentDate
    );
    const burned = this.getTotalCaloriesBurned(
      this.currentProfile.id,
      this.currentDate
    );
    const net = consumed - burned - bmr;

    document.getElementById("bmrValue").textContent = bmr;
    /* document.getElementById('tdeeValue').textContent = tdee; */
    document.getElementById("consumedValue").textContent = consumed;
    document.getElementById("burnedValue").textContent = burned;
    document.getElementById("netValue").textContent = net;

    // Update progress bar
    /* const progress = tdee > 0 ? (consumed / tdee) * 100 : 0;
        document.getElementById('calorieProgress').style.width = Math.min(progress, 100) + '%';
        document.getElementById('progressText').textContent = Math.round(progress) + '% of TDEE'; */
  }

  getTotalCaloriesConsumed(profileId, date) {
    if (
      !this.data.foodEntries[profileId] ||
      !this.data.foodEntries[profileId][date]
    ) {
      return 0;
    }
    return this.data.foodEntries[profileId][date].reduce(
      (total, entry) => total + entry.totalCalories,
      0
    );
  }

  getTotalCaloriesBurned(profileId, date) {
    if (
      !this.data.exerciseEntries[profileId] ||
      !this.data.exerciseEntries[profileId][date]
    ) {
      return 0;
    }
    return this.data.exerciseEntries[profileId][date].reduce(
      (total, entry) => total + entry.caloriesBurned,
      0
    );
  }

  // Summary and Charts
  showSummaryTab(summaryType) {
    // Hide all summary contents
    document.querySelectorAll(".summary-content").forEach((content) => {
      content.classList.remove("active");
    });

    // Show selected summary
    document.getElementById(`${summaryType}Summary`).classList.add("active");

    // Update tab buttons
    document.querySelectorAll(".summary-tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document
      .querySelector(`[data-summary="${summaryType}"]`)
      .classList.add("active");

    // Update charts
    this.updateSummaryCharts(summaryType);
  }

  updateSummaryCharts(type) {
    if (!this.currentProfile) return;

    setTimeout(() => {
      if (type === "daily") {
        this.updateDailyChart();
      } else if (type === "weekly") {
        this.updateWeeklyChart();
      } else if (type === "monthly") {
        this.updateMonthlyChart();
      }
    }, 100);
  }

  updateDailyChart() {
    const canvas = document.getElementById("dailyChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (this.charts.daily) {
      this.charts.daily.destroy();
    }

    const summaryDate =
      document.getElementById("summaryDate").value || this.currentDate;
    const consumed = this.getTotalCaloriesConsumed(
      this.currentProfile.id,
      summaryDate
    );
    const burned = this.getTotalCaloriesBurned(
      this.currentProfile.id,
      summaryDate
    );
    const bmr = Math.round(this.calculateBMR(this.currentProfile));

    const burnedVal = -burned;
    const bmrVal = -bmr;
    const finalTotal = consumed - bmr - burned;

    const getColor = (val) => (val >= 0 ? "green" : "red");

    this.charts.daily = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Daily Calories", "Final Total"],
        datasets: [
          {
            label: "Consumed",
            data: [consumed, null],
            backgroundColor: "#1FB8CD",
          },
          {
            label: "Burned (Exercise)",
            data: [burnedVal, null],
            backgroundColor: "#FFC185",
          },
          {
            label: "BMR",
            data: [bmrVal, null],
            backgroundColor: "#FF6B6B",
          },
          {
            label: "Final Total",
            data: [null, finalTotal],
            backgroundColor: getColor(finalTotal),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return value < 0 ? `-${Math.abs(value)}` : value;
              },
            },
            title: {
              display: true,
              text: "Calories",
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: `Daily Summary - ${summaryDate}`,
          },
        },
      },
    });
  }

  updateWeeklyChart() {
    const canvas = document.getElementById("weeklyChart");
    if (!canvas || !this.currentProfile) return;

    const ctx = canvas.getContext("2d");

    if (this.charts.weekly) {
      this.charts.weekly.destroy();
    }

    const labels = [];
    const consumed = [];
    const burned = [];
    const netData = [];
    const bmrConst = Math.round(this.calculateBMR(this.currentProfile));

    // Build last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(
        this.currentDate || new Date().toISOString().split("T")[0]
      );
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      const consumedVal = this.getTotalCaloriesConsumed(
        this.currentProfile.id,
        dateStr
      );
      const burnedVal = this.getTotalCaloriesBurned(
        this.currentProfile.id,
        dateStr
      );

      // Skip days with no data (do not push label or data)
      if (consumedVal === 0 && burnedVal === 0) continue;

      labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
      consumed.push(consumedVal);
      burned.push(burnedVal); // keep positive
      netData.push(consumedVal - burnedVal - bmrConst);
    }

    // Compute total net over included days
    const totalNet = netData.reduce((sum, v) => sum + v, 0);
    const totalNetText = `${
      totalNet >= 0 ? "Surplus" : "Deficit"
    } ${totalNet} kcal`;

    this.charts.weekly = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `Net Calories (${totalNetText})`,
            data: netData,
            borderColor: "#22c55e",
            borderWidth: 3,
            fill: false,
            pointBackgroundColor: netData.map((v) =>
              v >= 0 ? "#22c55e" : "#ef4444"
            ),
            pointRadius: 3,
            spanGaps: true,
          },
          {
            label: "Consumed",
            data: consumed,
            borderColor: "#3b82f6",
            fill: false,
            hidden: true,
            spanGaps: true,
          },
          {
            label: "Burned",
            data: burned,
            borderColor: "#f97316",
            fill: false,
            hidden: true,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: { display: true, text: "Calories" },
            grid: {
              color: (ctx) =>
                ctx.tick.value === 0 ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.1)",
              lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1),
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: `Weekly Summary • ${totalNetText}`,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || "";
                const val = context.parsed.y;
                return `${label}: ${val != null ? Math.round(val) : "-"} kcal`;
              },
            },
          },
          legend: {
            labels: {
              // Keep the dynamic total visible even if other datasets are toggled
              filter: (item) => true,
            },
          },
        },
      },
    });
  }

  updateMonthlyChart() {
    const canvas = document.getElementById("monthlyChart");
    if (!canvas || !this.currentProfile) return;

    const ctx = canvas.getContext("2d");

    if (this.charts.monthly) {
      this.charts.monthly.destroy();
    }

    const labels = [];
    const netData = [];
    const bmrConst = Math.round(this.calculateBMR(this.currentProfile));

    for (let i = 29; i >= 0; i--) {
      const d = new Date(
        this.currentDate || new Date().toISOString().split("T")[0]
      );
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      const consumedCals = this.getTotalCaloriesConsumed(
        this.currentProfile.id,
        dateStr
      );
      const burnedCals = this.getTotalCaloriesBurned(
        this.currentProfile.id,
        dateStr
      );

      // Skip when both consumed and burned are zero
      if (consumedCals === 0 && burnedCals === 0) continue;

      labels.push(d.getDate()); // day of month
      netData.push(consumedCals - burnedCals - bmrConst);
    }

    const totalNet = netData.reduce((s, v) => s + v, 0);
    const totalNetText = `${
      totalNet >= 0 ? "Surplus" : "Deficit"
    } ${totalNet} kcal`;

    this.charts.monthly = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `Net Calories (${totalNetText})`,
            data: netData,
            borderColor: "#5D878F",
            backgroundColor: "rgba(93, 135, 143, 0.12)",
            borderWidth: 3,
            fill: true,
            pointBackgroundColor: netData.map((v) =>
              v >= 0 ? "#22c55e" : "#ef4444"
            ),
            pointRadius: 2,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: { display: true, text: "Net Calories" },
            grid: {
              color: (ctx) =>
                ctx.tick.value === 0 ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.1)",
              lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1),
            },
          },
          x: {
            title: { display: true, text: "Day of Month" },
          },
        },
        plugins: {
          title: {
            display: true,
            text: `Monthly Net Calorie Trend • ${totalNetText}`,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.parsed.y;
                return `Net: ${val != null ? Math.round(val) : "-"} kcal`;
              },
            },
          },
        },
      },
    });
  }

  // Utility functions
  setCurrentDates() {
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("foodDate").value = today;
    document.getElementById("exerciseDate").value = today;
    document.getElementById("summaryDate").value = today;
    this.currentDate = today;
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
    }
  }

  updateUI() {
    this.updateProfileSelector();
    this.updateDashboard();
    this.renderFoodEntries();
    this.renderExerciseEntries();
    this.renderIngredients();
    this.renderProfiles();
  }
}

// Initialize the application
const app = new CalorieTracker();

// Make the app globally available for onclick handlers
window.app = app;
