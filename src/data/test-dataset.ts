import { TestUrl, TestDataset } from '@/types/comparison'

/**
 * Comprehensive test dataset for URL import technology comparison
 * 
 * This dataset includes URLs from various recipe website types to ensure
 * thorough evaluation of both Ollama and Traditional parsing approaches.
 */

export const TEST_URLS: TestUrl[] = [
  // Major food networks with good structured data
  {
    url: 'https://www.foodnetwork.com/recipes/alton-brown/good-eats-meatloaf-recipe-1944780',
    expectedRecipe: {
      title: 'Good Eats Meatloaf',
      ingredients: ['ground beef', 'onion', 'carrot', 'garlic', 'salt', 'pepper'],
      instructions: ['Preheat oven', 'Mix ingredients', 'Shape loaf', 'Bake']
    },
    websiteName: 'Food Network',
    difficulty: 'easy',
    hasStructuredData: true,
    notes: 'Professional recipe site with JSON-LD structured data'
  },
  {
    url: 'https://www.allrecipes.com/recipe/213742/cheesy-chicken-broccoli-casserole/',
    expectedRecipe: {
      title: 'Cheesy Chicken Broccoli Casserole',
      ingredients: ['chicken breast', 'broccoli', 'cheese', 'rice', 'cream soup'],
      instructions: ['Cook chicken', 'Steam broccoli', 'Layer ingredients', 'Bake']
    },
    websiteName: 'Allrecipes',
    difficulty: 'easy',
    hasStructuredData: true,
    notes: 'Community-driven recipe site with microdata'
  },

  // Food blogs with varying structured data quality
  {
    url: 'https://www.budgetbytes.com/slow-cooker-coconut-curry-lentils/',
    expectedRecipe: {
      title: 'Slow Cooker Coconut Curry Lentils',
      ingredients: ['red lentils', 'coconut milk', 'curry powder', 'onion', 'garlic'],
      instructions: ['Sauté aromatics', 'Add lentils and liquids', 'Cook in slow cooker']
    },
    websiteName: 'Budget Bytes',
    difficulty: 'medium',
    hasStructuredData: true,
    notes: 'Popular food blog with recipe cards'
  },
  {
    url: 'https://minimalistbaker.com/1-bowl-vegan-chocolate-cake/',
    expectedRecipe: {
      title: '1-Bowl Vegan Chocolate Cake',
      ingredients: ['flour', 'cocoa powder', 'sugar', 'baking soda', 'plant milk'],
      instructions: ['Mix dry ingredients', 'Add wet ingredients', 'Bake']
    },
    websiteName: 'Minimalist Baker',
    difficulty: 'easy',
    hasStructuredData: true,
    notes: 'Clean design food blog with recipe schema'
  },

  // International cuisine websites
  {
    url: 'https://www.bbcgoodfood.com/recipes/classic-lasagne',
    expectedRecipe: {
      title: 'Classic lasagne',
      ingredients: ['beef mince', 'lasagne sheets', 'tomatoes', 'cheese', 'béchamel'],
      instructions: ['Make meat sauce', 'Prepare béchamel', 'Layer ingredients', 'Bake']
    },
    websiteName: 'BBC Good Food',
    difficulty: 'medium',
    hasStructuredData: true,
    notes: 'UK-based recipe site with metric measurements'
  },

  // Chef and restaurant websites
  {
    url: 'https://www.seriouseats.com/perfect-pan-seared-steak-recipe',
    expectedRecipe: {
      title: 'Perfect Pan-Seared Steak',
      ingredients: ['steak', 'salt', 'pepper', 'butter', 'thyme', 'garlic'],
      instructions: ['Season steak', 'Heat pan', 'Sear steak', 'Add aromatics', 'Rest']
    },
    websiteName: 'Serious Eats',
    difficulty: 'medium',
    hasStructuredData: true,
    notes: 'Technical cooking site with detailed instructions'
  },

  // Simple recipe sites (potential for limited structured data)
  {
    url: 'https://www.tasteofhome.com/recipes/classic-beef-stew/',
    expectedRecipe: {
      title: 'Classic Beef Stew',
      ingredients: ['beef chunks', 'potatoes', 'carrots', 'onion', 'beef broth'],
      instructions: ['Brown beef', 'Add vegetables', 'Simmer', 'Season to taste']
    },
    websiteName: 'Taste of Home',
    difficulty: 'easy',
    hasStructuredData: true,
    notes: 'Traditional recipe magazine site'
  },

  // International sites (non-English)
  {
    url: 'https://www.marmiton.org/recettes/recette_ratatouille_23223.aspx',
    expectedRecipe: {
      title: 'Ratatouille',
      ingredients: ['courgettes', 'aubergines', 'tomates', 'poivrons', 'oignon'],
      instructions: ['Couper les légumes', 'Faire revenir', 'Mijoter']
    },
    websiteName: 'Marmiton',
    difficulty: 'medium',
    hasStructuredData: false,
    notes: 'French recipe site - tests non-English parsing'
  },

  // Video-first platforms
  {
    url: 'https://tasty.co/recipe/ultimate-chocolate-chip-cookies',
    expectedRecipe: {
      title: 'Ultimate Chocolate Chip Cookies',
      ingredients: ['flour', 'butter', 'brown sugar', 'eggs', 'chocolate chips'],
      instructions: ['Cream butter and sugar', 'Add eggs', 'Mix in flour', 'Add chips', 'Bake']
    },
    websiteName: 'Tasty',
    difficulty: 'easy',
    hasStructuredData: true,
    notes: 'Video-centric recipe platform'
  },

  // Specialty diet websites
  {
    url: 'https://www.paleorunningmomma.com/paleo-chicken-pad-thai-whole30/',
    expectedRecipe: {
      title: 'Paleo Chicken Pad Thai',
      ingredients: ['chicken', 'zucchini noodles', 'coconut aminos', 'lime', 'eggs'],
      instructions: ['Spiralize zucchini', 'Cook chicken', 'Make sauce', 'Toss together']
    },
    websiteName: 'Paleo Running Momma',
    difficulty: 'medium',
    hasStructuredData: true,
    notes: 'Specialty diet blog with detailed nutrition info'
  },

  // Simple home cooking blogs (potentially challenging)
  {
    url: 'https://www.spendwithpennies.com/wprm_print/recipe/207967',
    expectedRecipe: {
      title: 'Easy Chicken and Rice Casserole',
      ingredients: ['chicken', 'rice', 'vegetables', 'broth', 'cheese'],
      instructions: ['Layer ingredients', 'Pour broth', 'Cover and bake']
    },
    websiteName: 'Spend with Pennies',
    difficulty: 'easy',
    hasStructuredData: true,
    notes: 'Budget-focused family cooking blog'
  },

  // Magazine websites
  {
    url: 'https://www.bonappetit.com/recipe/bas-best-chocolate-chip-cookies',
    expectedRecipe: {
      title: "BA's Best Chocolate Chip Cookies",
      ingredients: ['bread flour', 'butter', 'brown sugar', 'eggs', 'chocolate'],
      instructions: ['Brown butter', 'Mix dough', 'Chill', 'Bake']
    },
    websiteName: 'Bon Appétit',
    difficulty: 'medium',
    hasStructuredData: true,
    notes: 'High-end food magazine with professional recipes'
  },

  // Recipe aggregators
  {
    url: 'https://www.yummly.com/recipe/Slow-Cooker-Chicken-and-Dumplings-9038095',
    expectedRecipe: {
      title: 'Slow Cooker Chicken and Dumplings',
      ingredients: ['chicken', 'vegetables', 'biscuit dough', 'broth'],
      instructions: ['Add ingredients to slow cooker', 'Cook', 'Add dumplings', 'Finish']
    },
    websiteName: 'Yummly',
    difficulty: 'easy',
    hasStructuredData: true,
    notes: 'Recipe aggregation platform'
  }
]

// Organized test datasets for different evaluation scenarios
export const TEST_DATASETS: Record<string, TestDataset> = {
  'basic-evaluation': {
    name: 'Basic Technology Evaluation',
    description: 'Core set of 8 diverse recipes for initial comparison testing',
    urls: TEST_URLS.slice(0, 8),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },

  'structured-data-focus': {
    name: 'Structured Data Analysis',
    description: 'URLs with confirmed JSON-LD/microdata for structured parsing evaluation',
    urls: TEST_URLS.filter(url => url.hasStructuredData),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },

  'challenging-sites': {
    name: 'Challenging Parsing Scenarios',
    description: 'Difficult cases including non-English, minimal structure, and complex layouts',
    urls: TEST_URLS.filter(url => url.difficulty === 'medium' || !url.hasStructuredData),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },

  'comprehensive': {
    name: 'Comprehensive Evaluation Suite',
    description: 'Complete test dataset covering all website types and scenarios',
    urls: TEST_URLS,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },

  'quick-validation': {
    name: 'Quick Validation Set',
    description: 'Small set of reliable URLs for fast testing during development',
    urls: TEST_URLS.filter(url => url.difficulty === 'easy' && url.hasStructuredData).slice(0, 4),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  }
}

// Website type classification for analysis
export const WEBSITE_CATEGORIES = {
  'Major Networks': ['Food Network', 'Allrecipes', 'BBC Good Food'],
  'Food Blogs': ['Budget Bytes', 'Minimalist Baker', 'Paleo Running Momma', 'Spend with Pennies'],
  'Magazine Sites': ['Bon Appétit', 'Taste of Home', 'Serious Eats'],
  'Video Platforms': ['Tasty'],
  'Aggregators': ['Yummly'],
  'International': ['Marmiton']
}

// Evaluation criteria weights for different scenarios
export const EVALUATION_WEIGHTS = {
  'accuracy-focused': {
    titleAccuracy: 0.3,
    ingredientsAccuracy: 0.4,
    instructionsAccuracy: 0.3,
    processingTime: 0.0
  },
  'speed-focused': {
    titleAccuracy: 0.2,
    ingredientsAccuracy: 0.2,
    instructionsAccuracy: 0.2,
    processingTime: 0.4
  },
  'balanced': {
    titleAccuracy: 0.25,
    ingredientsAccuracy: 0.35,
    instructionsAccuracy: 0.25,
    processingTime: 0.15
  }
} 