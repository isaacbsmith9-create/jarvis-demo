// Built-in food database: common foods + athlete staples, per listed serving.
// Values are typical USDA-style figures, rounded. Works fully offline; the
// server adds Open Food Facts (branded/packaged foods) on top when reachable.

// [name, serving, calories, protein, carbs, fat, fiber]
const ROWS = [
  // Protein
  ['Chicken breast, grilled', '4 oz', 187, 35, 0, 4, 0],
  ['Chicken thigh, roasted', '4 oz', 235, 28, 0, 13, 0],
  ['Ground beef 90/10, cooked', '4 oz', 245, 28, 0, 14, 0],
  ['Ground turkey 93/7, cooked', '4 oz', 200, 27, 0, 10, 0],
  ['Steak, sirloin', '4 oz', 230, 34, 0, 10, 0],
  ['Salmon, baked', '4 oz', 235, 25, 0, 14, 0],
  ['Tuna, canned in water', '1 can (5 oz)', 120, 26, 0, 1, 0],
  ['Shrimp, cooked', '4 oz', 112, 27, 0, 1, 0],
  ['Egg, large', '1 egg', 72, 6, 0.4, 5, 0],
  ['Egg whites', '1/2 cup', 63, 13, 1, 0, 0],
  ['Bacon', '2 slices', 86, 6, 0, 7, 0],
  ['Turkey deli slices', '2 oz', 60, 10, 2, 1, 0],
  ['Whey protein shake (water)', '1 scoop', 120, 24, 3, 1.5, 0],
  ['Greek yogurt, nonfat plain', '1 cup (227 g)', 130, 23, 9, 0, 0],
  ['Cottage cheese 2%', '1 cup', 180, 24, 10, 5, 0],
  ['Tofu, firm', '1/2 cup', 180, 20, 4, 11, 2],
  // Dairy
  ['Milk, 2%', '1 cup', 122, 8, 12, 5, 0],
  ['Milk, whole', '1 cup', 149, 8, 12, 8, 0],
  ['Chocolate milk, lowfat', '1 cup', 190, 8, 30, 2.5, 1],
  ['Cheddar cheese', '1 oz', 114, 7, 0.4, 9, 0],
  ['String cheese', '1 stick', 80, 7, 1, 6, 0],
  // Carbs
  ['White rice, cooked', '1 cup', 205, 4, 45, 0.4, 0.6],
  ['Brown rice, cooked', '1 cup', 218, 5, 46, 1.6, 3.5],
  ['Pasta, cooked', '1 cup', 220, 8, 43, 1.3, 2.5],
  ['Oatmeal, cooked', '1 cup', 166, 6, 28, 3.6, 4],
  ['Rolled oats, dry', '1/2 cup (40 g)', 150, 5, 27, 3, 4],
  ['Whole wheat bread', '1 slice', 81, 4, 14, 1, 2],
  ['White bread', '1 slice', 75, 2.6, 14, 1, 0.8],
  ['Bagel, plain', '1 medium', 277, 11, 55, 1.4, 2.4],
  ['Flour tortilla (8 in)', '1 tortilla', 146, 4, 25, 3.5, 1.5],
  ['Sweet potato, baked', '1 medium', 103, 2, 24, 0.2, 3.8],
  ['Potato, baked', '1 medium', 161, 4, 37, 0.2, 3.8],
  ['Granola', '1/2 cup', 240, 6, 34, 10, 4],
  ['Cereal (Cheerios-style)', '1 cup', 100, 3, 20, 2, 3],
  ['Pancakes', '2 medium', 180, 5, 28, 5, 1],
  ['Rice cakes', '2 cakes', 70, 1.5, 15, 0.5, 0.8],
  // Fruit & veg
  ['Banana', '1 medium', 105, 1.3, 27, 0.4, 3.1],
  ['Apple', '1 medium', 95, 0.5, 25, 0.3, 4.4],
  ['Orange', '1 medium', 62, 1.2, 15, 0.2, 3.1],
  ['Blueberries', '1 cup', 84, 1.1, 21, 0.5, 3.6],
  ['Strawberries', '1 cup', 49, 1, 12, 0.5, 3],
  ['Grapes', '1 cup', 104, 1, 27, 0.2, 1.4],
  ['Broccoli, cooked', '1 cup', 55, 3.7, 11, 0.6, 5],
  ['Spinach, raw', '2 cups', 14, 1.7, 2, 0.2, 1.3],
  ['Mixed salad greens', '2 cups', 15, 1, 3, 0, 1.5],
  ['Carrots, baby', '10 carrots', 35, 0.6, 8, 0.1, 2.9],
  ['Avocado', '1/2 fruit', 160, 2, 9, 15, 7],
  ['Orange juice', '1 cup', 112, 1.7, 26, 0.5, 0.5],
  // Fats & snacks
  ['Peanut butter', '2 tbsp', 190, 7, 7, 16, 2],
  ['Almonds', '1 oz (23 nuts)', 164, 6, 6, 14, 3.5],
  ['Olive oil', '1 tbsp', 119, 0, 0, 13.5, 0],
  ['Butter', '1 tbsp', 102, 0.1, 0, 11.5, 0],
  ['Trail mix', '1/4 cup', 175, 5, 16, 11, 2],
  ['Protein bar', '1 bar', 210, 20, 22, 7, 3],
  ['Granola bar', '1 bar', 120, 2, 19, 4.5, 1],
  ['Beef jerky', '1 oz', 116, 9, 3, 7, 0.5],
  ['Hummus', '2 tbsp', 70, 2, 4, 5, 1],
  ['Tortilla chips', '1 oz', 140, 2, 18, 7, 1.5],
  ['Potato chips', '1 oz', 152, 2, 15, 10, 1.2],
  ['Dark chocolate', '1 oz', 170, 2, 13, 12, 3],
  // Drinks
  ['Sports drink', '20 oz bottle', 140, 0, 36, 0, 0],
  ['Soda', '12 oz can', 150, 0, 39, 0, 0],
  ['Coffee, black', '1 cup', 2, 0.3, 0, 0, 0],
  // Meals / fast food style
  ['Cheeseburger', '1 burger', 300, 15, 33, 12, 1.5],
  ['Pepperoni pizza', '1 slice (large)', 310, 13, 35, 13, 2],
  ['Burrito, chicken', '1 burrito', 650, 40, 70, 22, 8],
  ['Chicken nuggets', '6 pieces', 270, 14, 16, 17, 1],
  ['French fries', 'medium', 340, 4, 44, 16, 4],
  ['Turkey sandwich', '1 sandwich', 350, 24, 38, 10, 4],
  ['PB&J sandwich', '1 sandwich', 380, 12, 50, 16, 4],
  ['Chicken Caesar salad', '1 bowl', 450, 35, 15, 28, 3],
  ['Chicken rice bowl', '1 bowl', 600, 42, 70, 15, 4],
  ['Spaghetti with meat sauce', '1.5 cups', 480, 25, 60, 15, 5],
  ['Mac and cheese', '1 cup', 310, 12, 36, 13, 1.5],
];

export const FOODS = ROWS.map(([name, serving, calories, protein, carbs, fat, fiber], i) => ({
  id: `local-${i}`,
  source: 'built-in',
  name,
  serving,
  calories,
  protein,
  carbs,
  fat,
  fiber,
}));

/** Case-insensitive token search; every query word must appear in the name. */
export function searchLocal(query, limit = 25) {
  const words = String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  return FOODS.filter((f) => {
    const n = f.name.toLowerCase();
    return words.every((w) => n.includes(w));
  })
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, limit);
}
