BEGIN;

TRUNCATE TABLE
    order_items,
    orders,
    menu_items,
    menus,
    restaurants,
    confirmation_codes,
    users
RESTART IDENTITY CASCADE;

INSERT INTO users
(name, password, email, phone, role, deleted_at, active)
VALUES

    ('Administrator',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'admin@fooddelivery.local',
     '+10000000001',
     'ADMIN',
     NULL,
     true),

    ('Delivery Manager',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'manager@fooddelivery.local',
     '+10000000002',
     'MANAGER',
     NULL,
     true),

    ('John Smith',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer01@fooddelivery.local',
     '+10000000101',
     'CUSTOMER',
     NULL,
     true),

    ('Emma Johnson',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer02@fooddelivery.local',
     '+10000000102',
     'CUSTOMER',
     NULL,
     true),

    ('Michael Brown',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer03@fooddelivery.local',
     '+10000000103',
     'CUSTOMER',
     NULL,
     true),

    ('Olivia Davis',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer04@fooddelivery.local',
     '+10000000104',
     'CUSTOMER',
     NULL,
     true),

    ('William Wilson',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer05@fooddelivery.local',
     '+10000000105',
     'CUSTOMER',
     NULL,
     true),

    ('Sophia Moore',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer06@fooddelivery.local',
     '+10000000106',
     'CUSTOMER',
     NULL,
     true),

    ('James Taylor',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer07@fooddelivery.local',
     '+10000000107',
     'CUSTOMER',
     NULL,
     true),

    ('Charlotte Anderson',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer08@fooddelivery.local',
     '+10000000108',
     'CUSTOMER',
     NULL,
     true),

    ('Benjamin Thomas',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer09@fooddelivery.local',
     '+10000000109',
     'CUSTOMER',
     NULL,
     true),

    ('Amelia Jackson',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer10@fooddelivery.local',
     '+10000000110',
     'CUSTOMER',
     NULL,
     true),

    ('Lucas White',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer11@fooddelivery.local',
     '+10000000111',
     'CUSTOMER',
     NULL,
     true),

    ('Mia Harris',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer12@fooddelivery.local',
     '+10000000112',
     'CUSTOMER',
     NULL,
     true),

    ('Henry Martin',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer13@fooddelivery.local',
     '+10000000113',
     'CUSTOMER',
     NULL,
     true),

    ('Evelyn Thompson',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer14@fooddelivery.local',
     '+10000000114',
     'CUSTOMER',
     NULL,
     true),

    ('Alexander Garcia',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer15@fooddelivery.local',
     '+10000000115',
     'CUSTOMER',
     NULL,
     true),

    ('Harper Martinez',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer16@fooddelivery.local',
     '+10000000116',
     'CUSTOMER',
     NULL,
     true),

    ('Daniel Robinson',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer17@fooddelivery.local',
     '+10000000117',
     'CUSTOMER',
     NULL,
     true),

    ('Ella Clark',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer18@fooddelivery.local',
     '+10000000118',
     'CUSTOMER',
     NULL,
     true),

    ('Matthew Lewis',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer19@fooddelivery.local',
     '+10000000119',
     'CUSTOMER',
     NULL,
     true),

    ('Grace Walker',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'customer20@fooddelivery.local',
     '+10000000120',
     'CUSTOMER',
     NULL,
     true),

    ('Courier One',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier01@fooddelivery.local',
     '+10000000201',
     'COURIER',
     NULL,
     true),

    ('Courier Two',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier02@fooddelivery.local',
     '+10000000202',
     'COURIER',
     NULL,
     true),

    ('Courier Three',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier03@fooddelivery.local',
     '+10000000203',
     'COURIER',
     NULL,
     true),

    ('Courier Four',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier04@fooddelivery.local',
     '+10000000204',
     'COURIER',
     NULL,
     true),

    ('Courier Five',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier05@fooddelivery.local',
     '+10000000205',
     'COURIER',
     NULL,
     true),

    ('Courier Six',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier06@fooddelivery.local',
     '+10000000206',
     'COURIER',
     NULL,
     true),

    ('Courier Seven',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier07@fooddelivery.local',
     '+10000000207',
     'COURIER',
     NULL,
     true),

    ('Courier Eight',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier08@fooddelivery.local',
     '+10000000208',
     'COURIER',
     NULL,
     true),

    ('Courier Nine',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier09@fooddelivery.local',
     '+10000000209',
     'COURIER',
     NULL,
     true),

    ('Courier Ten',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier10@fooddelivery.local',
     '+10000000210',
     'COURIER',
     NULL,
     true),

    ('Courier Eleven',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier11@fooddelivery.local',
     '+10000000211',
     'COURIER',
     NULL,
     true),

    ('Courier Twelve',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier12@fooddelivery.local',
     '+10000000212',
     'COURIER',
     NULL,
     true),

    ('Courier Thirteen',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier13@fooddelivery.local',
     '+10000000213',
     'COURIER',
     NULL,
     true),

    ('Courier Fourteen',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier14@fooddelivery.local',
     '+10000000214',
     'COURIER',
     NULL,
     true),

    ('Courier Fifteen',
     '$2b$10$gxpsKmejBya.yn4.cs.D6eZDibzyLZAENlPvxI10/VIxa3/WLTjZe',
     'courier15@fooddelivery.local',
     '+10000000215',
     'COURIER',
     NULL,
     true);

-- =====================================================
-- RESTAURANTS
-- =====================================================

INSERT INTO restaurants
(name, address, phone, email, active)
VALUES

    (
        'Pizza House',
        '12 Main Street',
        '+10010000001',
        'pizza.house@fooddelivery.local',
        true
    ),

    (
        'Sushi Master',
        '25 Sakura Avenue',
        '+10010000002',
        'sushi.master@fooddelivery.local',
        true
    ),

    (
        'Burger Point',
        '8 King Road',
        '+10010000003',
        'burger.point@fooddelivery.local',
        true
    ),

    (
        'Italiano',
        '41 Roma Street',
        '+10010000004',
        'italiano@fooddelivery.local',
        true
    ),

    (
        'Tokyo Roll',
        '77 Tokyo Avenue',
        '+10010000005',
        'tokyo.roll@fooddelivery.local',
        true
    ),

    (
        'BBQ Factory',
        '5 Grill Street',
        '+10010000006',
        'bbq.factory@fooddelivery.local',
        true
    ),

    (
        'Healthy Food',
        '9 Green Road',
        '+10010000007',
        'healthy.food@fooddelivery.local',
        true
    ),

    (
        'Steak House',
        '15 Premium Avenue',
        '+10010000008',
        'steak.house@fooddelivery.local',
        true
    ),

    (
        'Coffee Time',
        '3 Central Square',
        '+10010000009',
        'coffee.time@fooddelivery.local',
        true
    ),

    (
        'Green Bowl',
        '27 Fresh Street',
        '+10010000010',
        'green.bowl@fooddelivery.local',
        true
    );

-- =====================================================
-- MENUS
-- =====================================================

INSERT INTO menus
(name, restaurant_id, active)
VALUES

    ('Main Menu', 1, true),
    ('Main Menu', 2, true),
    ('Main Menu', 3, true),
    ('Main Menu', 4, true),
    ('Main Menu', 5, true),
    ('Main Menu', 6, true),
    ('Main Menu', 7, true),
    ('Main Menu', 8, true),
    ('Main Menu', 9, true),
    ('Main Menu',10, true);

-- =====================================================
-- MENU ITEMS
-- =====================================================

--------------------------------------------------------
-- Menu #1 - Pizza House
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (1,'Margherita','Classic pizza with mozzarella and tomato sauce',9.90,true),
    (1,'Pepperoni','Pepperoni, mozzarella and tomato sauce',11.90,true),
    (1,'Four Cheese','Mozzarella, cheddar, parmesan and gorgonzola',12.90,true),
    (1,'Hawaiian','Ham, pineapple and mozzarella',11.50,true),
    (1,'BBQ Chicken','Chicken, BBQ sauce and onions',13.90,true),
    (1,'Carbonara','Cream sauce, bacon and parmesan',12.50,true),
    (1,'Diavola','Spicy salami and chili peppers',13.20,true),
    (1,'Vegetarian','Fresh vegetables and mozzarella',10.90,true),
    (1,'Meat Lovers','Bacon, ham, pepperoni and beef',15.90,true),
    (1,'Caesar Pizza','Chicken, parmesan and Caesar sauce',13.40,true);

--------------------------------------------------------
-- Menu #2 - Sushi Master
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (2,'Philadelphia','Salmon, cream cheese and cucumber',12.90,true),
    (2,'California','Crab, avocado and cucumber',11.50,true),
    (2,'Dragon Roll','Eel, avocado and cucumber',14.90,true),
    (2,'Salmon Nigiri','Fresh salmon over rice',6.90,true),
    (2,'Tuna Nigiri','Fresh tuna over rice',7.50,true),
    (2,'Tempura Roll','Shrimp tempura roll',13.90,true),
    (2,'Spicy Tuna Roll','Spicy tuna with chili sauce',12.50,true),
    (2,'Ebi Roll','Shrimp, cucumber and avocado',13.20,true),
    (2,'Miso Soup','Traditional Japanese soup',4.90,true),
    (2,'Wakame Salad','Seaweed salad with sesame',5.90,true);

--------------------------------------------------------
-- Menu #3 - Burger Point
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (3,'Classic Burger','Beef, cheese and lettuce',10.90,true),
    (3,'Cheeseburger','Double cheese burger',11.90,true),
    (3,'Bacon Burger','Burger with crispy bacon',12.90,true),
    (3,'Chicken Burger','Grilled chicken breast burger',11.50,true),
    (3,'BBQ Burger','Burger with BBQ sauce',12.50,true),
    (3,'Double Burger','Double beef patties',15.90,true),
    (3,'French Fries','Crispy french fries',4.50,true),
    (3,'Onion Rings','Golden fried onion rings',5.50,true),
    (3,'Chicken Nuggets','8 crispy nuggets',6.90,true),
    (3,'Milkshake','Vanilla milkshake',4.90,true);

--------------------------------------------------------
-- Menu #4 - Italiano
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (4,'Spaghetti Carbonara','Spaghetti with bacon, egg and parmesan',13.90,true),
    (4,'Lasagna Bolognese','Classic beef lasagna',14.90,true),
    (4,'Fettuccine Alfredo','Cream sauce with parmesan',13.50,true),
    (4,'Penne Arrabbiata','Spicy tomato sauce',11.90,true),
    (4,'Risotto ai Funghi','Mushroom risotto',14.20,true),
    (4,'Gnocchi','Potato dumplings with cream sauce',12.90,true),
    (4,'Ravioli Ricotta','Ricotta and spinach ravioli',13.90,true),
    (4,'Caprese Salad','Tomato, mozzarella and basil',9.90,true),
    (4,'Tiramisu','Traditional Italian dessert',6.90,true),
    (4,'Panna Cotta','Vanilla cream dessert',6.50,true);

--------------------------------------------------------
-- Menu #5 - Tokyo Roll
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (5,'Rainbow Roll','Mixed fish and avocado',15.90,true),
    (5,'Volcano Roll','Baked spicy salmon roll',15.50,true),
    (5,'Salmon Sashimi','Fresh salmon slices',11.90,true),
    (5,'Tuna Sashimi','Fresh tuna slices',12.90,true),
    (5,'Shrimp Tempura','Deep fried shrimp',10.90,true),
    (5,'Chicken Teriyaki','Chicken with teriyaki sauce',13.90,true),
    (5,'Yakisoba','Japanese fried noodles',12.90,true),
    (5,'Poke Bowl','Salmon poke bowl',14.50,true),
    (5,'Edamame','Steamed soy beans',5.50,true),
    (5,'Green Tea Ice Cream','Matcha ice cream',5.90,true);

--------------------------------------------------------
-- Menu #6 - BBQ Factory
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (6,'BBQ Ribs','Slow cooked pork ribs',18.90,true),
    (6,'Pulled Pork Burger','Pulled pork with BBQ sauce',14.50,true),
    (6,'Smoked Brisket','Texas style brisket',19.90,true),
    (6,'Grilled Chicken','Chicken breast from grill',13.90,true),
    (6,'Buffalo Wings','Hot chicken wings',11.90,true),
    (6,'BBQ Sausage','Grilled homemade sausage',10.90,true),
    (6,'Loaded Fries','Fries with cheese and bacon',8.90,true),
    (6,'Coleslaw','Fresh cabbage salad',4.90,true),
    (6,'Corn on the Cob','Grilled sweet corn',5.50,true),
    (6,'Apple Pie','Homemade apple pie',6.90,true);

--------------------------------------------------------
-- Menu #7 - Healthy Food
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (7,'Chicken Bowl','Chicken, rice and vegetables',12.90,true),
    (7,'Salmon Bowl','Salmon with avocado',14.90,true),
    (7,'Greek Salad','Fresh vegetables with feta',9.90,true),
    (7,'Caesar Salad','Chicken Caesar salad',11.90,true),
    (7,'Avocado Toast','Whole grain bread with avocado',8.90,true),
    (7,'Protein Smoothie','Banana protein smoothie',6.90,true),
    (7,'Fruit Bowl','Seasonal fruits',7.90,true),
    (7,'Quinoa Bowl','Quinoa and roasted vegetables',12.50,true),
    (7,'Veggie Wrap','Fresh vegetable wrap',9.90,true),
    (7,'Fresh Orange Juice','Freshly squeezed orange juice',4.90,true);

--------------------------------------------------------
-- Menu #8 - Steak House
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (8,'Ribeye Steak','300g premium ribeye',28.90,true),
    (8,'Filet Mignon','Tender beef filet',31.90,true),
    (8,'New York Strip','Strip steak',27.90,true),
    (8,'T-Bone Steak','Large T-bone steak',34.90,true),
    (8,'Grilled Salmon','Fresh grilled salmon',22.90,true),
    (8,'Mashed Potatoes','Creamy mashed potatoes',5.90,true),
    (8,'Grilled Vegetables','Seasonal vegetables',6.90,true),
    (8,'Pepper Sauce','Creamy pepper sauce',3.50,true),
    (8,'Chocolate Cake','Chocolate lava cake',7.90,true),
    (8,'Cheesecake','Classic New York cheesecake',7.50,true);

--------------------------------------------------------
-- Menu #9 - Coffee Time
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (9,'Espresso','Italian espresso',2.90,true),
    (9,'Americano','Espresso with hot water',3.20,true),
    (9,'Cappuccino','Coffee with milk foam',3.90,true),
    (9,'Latte','Milk coffee',4.20,true),
    (9,'Flat White','Double espresso with milk',4.50,true),
    (9,'Croissant','Butter croissant',3.50,true),
    (9,'Blueberry Muffin','Fresh baked muffin',3.90,true),
    (9,'Cheesecake','Cream cheese cake',5.90,true),
    (9,'Chocolate Brownie','Chocolate brownie',4.90,true),
    (9,'Tea Selection','Black or green tea',2.80,true);

--------------------------------------------------------
-- Menu #10 - Green Bowl
--------------------------------------------------------

INSERT INTO menu_items
(menu_id, name, description, price, active)
VALUES
    (10,'Falafel Bowl','Falafel with vegetables',11.90,true),
    (10,'Vegan Bowl','Fresh vegan bowl',12.90,true),
    (10,'Mediterranean Bowl','Hummus and vegetables',12.50,true),
    (10,'Tofu Bowl','Grilled tofu and rice',11.90,true),
    (10,'Avocado Salad','Fresh avocado salad',9.90,true),
    (10,'Falafel Wrap','Falafel in pita bread',9.50,true),
    (10,'Hummus Plate','Homemade hummus',7.50,true),
    (10,'Lentil Soup','Traditional lentil soup',6.90,true),
    (10,'Fresh Lemonade','Homemade lemonade',3.90,true),
    (10,'Vegan Cheesecake','Plant-based dessert',6.90,true);