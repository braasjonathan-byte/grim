// Kurerad meny för vanliga kedjor i Sverige. Värden per portion (ungefärliga, från kedjornas
// publicerade näringsinfo). g = portionsvikt. aliases = andra namn/stavningar.
export interface MenuItem { r: string; n: string; g: number; kcal: number; p: number; f: number; c: number; a?: string[] }

const M = (r: string, rows: [string, number, number, number, number, number, string[]?][]): MenuItem[] =>
  rows.map(([n, g, kcal, p, f, c, a]) => ({ r, n, g, kcal, p, f, c, a }));

export const SWEDISH_CHAINS = ["McDonald's", "Max", "Sibylla", "Burger King", "Pizza Hut", "Espresso House", "Waynes Coffee", "Subway", "KFC", "Pressbyrån", "7-Eleven", "Joe & The Juice", "O'Learys", "Taco Bar", "Bastard Burgers", "Frasses", "Jureskogs"];

export const RESTAURANT_MENU: MenuItem[] = [
  ...M("McDonald's", [
    ["Big Mac", 219, 508, 26, 25, 43],
    ["Triple Cheeseburger", 205, 540, 33, 30, 33, ["trippel cheeseburgare", "triple cheese"]],
    ["Double Cheeseburger", 165, 437, 26, 23, 32, ["dubbel cheeseburgare", "double cheese"]],
    ["Cheeseburger", 118, 298, 15, 12, 31, ["cheeseburgare", "ostburgare"]],
    ["Hamburgare", 104, 254, 13, 8, 31, ["hamburger"]],
    ["Quarter Pounder with Cheese", 200, 518, 30, 26, 39, ["qp", "qpc", "quarter pounder"]],
    ["Double Quarter Pounder with Cheese", 280, 760, 48, 43, 40, ["dubbel quarter pounder"]],
    ["McFeast", 230, 520, 27, 29, 38],
    ["McChicken", 167, 400, 16, 17, 43],
    ["Chicken McNuggets 6 st", 103, 260, 15, 15, 16, ["nuggets", "mcnuggets"]],
    ["Chicken McNuggets 9 st", 155, 390, 23, 23, 24, ["nuggets 9", "mcnuggets 9"]],
    ["Filet-O-Fish", 136, 330, 15, 13, 36, ["fish burger", "fiskburgare"]],
    ["McWrap Chicken", 230, 500, 26, 22, 49, ["wrap"]],
    ["Pommes frites mellan", 114, 330, 4, 16, 41, ["fries", "pommes"]],
    ["Pommes frites stor", 150, 440, 5, 21, 54, ["large fries", "stora pommes"]],
    ["McFlurry Oreo", 180, 340, 8, 11, 53, ["mcflurry"]],
    ["Coca-Cola mellan 0,4 l", 400, 168, 0, 0, 42, ["cola", "coke"]],
  ]),
  ...M("Max", [
    ["Originalburgare", 160, 420, 22, 21, 36, ["original"]],
    ["Grandiosa Burgare", 260, 690, 34, 40, 46],
    ["Big Deluxe", 300, 740, 38, 44, 45],
    ["Frisco", 260, 650, 33, 37, 44],
    ["Halloumi Burgare", 230, 610, 23, 34, 51, ["halloumi"]],
    ["Max Cheeseburgare", 130, 340, 18, 15, 33, ["cheeseburger"]],
    ["Dubbel Cheese", 190, 520, 30, 29, 34, ["double cheeseburger"]],
    ["Crispy Chicken", 210, 520, 24, 25, 49, ["kyckling burgare"]],
    ["Pommes frites mellan", 120, 340, 4, 17, 42, ["fries", "pommes"]],
    ["Chicken Nuggets 6 st", 100, 250, 14, 14, 17, ["nuggets"]],
  ]),
  ...M("Burger King", [
    ["Whopper", 290, 660, 28, 40, 49],
    ["Double Whopper", 375, 900, 48, 58, 49, ["dubbel whopper"]],
    ["Whopper Jr", 150, 330, 15, 18, 28, ["whopper junior"]],
    ["Cheeseburger", 120, 300, 16, 13, 30, ["cheeseburgare"]],
    ["Double Cheeseburger", 160, 430, 25, 23, 31],
    ["Bacon King", 340, 1150, 61, 79, 49],
    ["Long Chicken", 220, 600, 22, 32, 56],
    ["Chicken Nuggets 6 st", 95, 260, 13, 16, 16, ["nuggets"]],
    ["Pommes frites mellan", 116, 340, 4, 15, 45, ["fries", "pommes"]],
    ["Onion Rings", 100, 320, 4, 16, 39, ["lökringar"]],
  ]),
  ...M("Sibylla", [
    ["Grillkorv med bröd", 130, 330, 11, 19, 29, ["korv med bröd", "grillad korv"]],
    ["Kokt korv med bröd", 130, 310, 10, 18, 28, ["kokt korv"]],
    ["Tunnbrödsrulle", 380, 850, 22, 45, 88, ["tunnbrodsrulle", "korv med mos tunnbröd"]],
    ["Sibyllaburgare", 180, 470, 22, 24, 40, ["hamburgare", "burgare"]],
    ["Korv med mos", 330, 560, 14, 34, 48],
    ["Pommes frites", 150, 420, 5, 20, 54, ["pommes"]],
  ]),
  ...M("Subway", [
    ["Subway Club 15 cm", 230, 340, 25, 6, 45, ["club"]],
    ["Chicken Teriyaki 15 cm", 260, 380, 27, 5, 57, ["teriyaki"]],
    ["Italian BMT 15 cm", 230, 410, 20, 17, 44, ["bmt"]],
    ["Tuna 15 cm", 240, 470, 20, 24, 43, ["tonfisk"]],
    ["Veggie Delite 15 cm", 170, 230, 9, 3, 42, ["veggie"]],
    ["Meatball Marinara 15 cm", 280, 480, 22, 19, 55, ["köttbullar", "meatball"]],
  ]),
  ...M("KFC", [
    ["Zinger Burger", 210, 450, 25, 19, 45, ["zinger"]],
    ["Fillet Burger", 200, 430, 27, 15, 45],
    ["Hot Wings 5 st", 120, 330, 22, 22, 11, ["wings"]],
    ["Original Recipe bit", 110, 250, 21, 15, 8, ["kycklingbit"]],
    ["Popcorn Chicken", 110, 300, 17, 17, 20],
  ]),
  ...M("Pizza Hut", [
    ["Margherita Pan Pizza medium (bit)", 110, 270, 12, 11, 30, ["margarita", "pizza"]],
    ["Pepperoni Pan Pizza medium (bit)", 115, 300, 13, 14, 30, ["pepperoni"]],
    ["Hawaii Pan Pizza medium (bit)", 120, 280, 13, 11, 32, ["hawaii"]],
  ]),
  ...M("Espresso House", [
    ["Caffe Latte mellan", 350, 190, 11, 9, 15, ["latte"]],
    ["Cappuccino mellan", 300, 130, 7, 6, 10],
    ["Chai Latte mellan", 350, 260, 8, 7, 42, ["chai"]],
    ["Kanelbulle", 100, 360, 6, 15, 50, ["kanelbulle", "bulle"]],
    ["Kladdkaka", 90, 390, 5, 24, 40],
    ["Chokladboll", 60, 260, 3, 14, 30],
  ]),
  ...M("Waynes Coffee", [
    ["Caffe Latte mellan", 350, 190, 11, 9, 15, ["latte"]],
    ["Cappuccino mellan", 300, 130, 7, 6, 10],
    ["Kanelbulle", 100, 350, 6, 14, 50, ["bulle"]],
    ["Morotskaka", 120, 450, 5, 25, 52, ["carrot cake"]],
  ]),
  ...M("Pressbyrån", [
    ["Korv med bröd", 130, 320, 11, 18, 29, ["varmkorv", "hot dog"]],
    ["Kanelbulle", 100, 360, 6, 15, 50, ["bulle"]],
  ]),
  ...M("7-Eleven", [
    ["Korv med bröd", 130, 320, 11, 18, 29, ["varmkorv", "hot dog"]],
    ["Kycklingwrap", 200, 420, 20, 15, 48, ["wrap"]],
  ]),
  ...M("Joe & The Juice", [
    ["Tunacado", 230, 520, 26, 23, 50],
    ["Joe's Club", 230, 490, 30, 18, 49, ["club"]],
    ["Proteinshake", 400, 320, 25, 5, 45, ["shake"]],
  ]),
];
