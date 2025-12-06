# GDP_Inequality
This project presents an interactive web-based visualization that explores the relationship between GDP, the Gender Inequality Index (GII), and the gender pay gap in countries around the world.This website uses Leaflet.js for geographic mapping and D3.js for dynamic scatter plots and interactive logic.

Main functions
1.The world map dynamically displays the GDP levels and gender inequality indices of different countries in various colors, depending on the user's choice.
2. Hover over any country to view its GDP/GII and wage gap
3. Click on the country to view the location of the relevant scattered points.
4. The scatter plot is automatically updated based on the selected metrics. One can choose wage gap vs. GDP, or wage gap versus gender inequality index and a three-variable scatter plot.
5. Hovering the dot can display the location on the national map as well as related values.
6. Since not every country has salary data, a list of countries with data is set at the bottom of the map. Clicking on a country will display map highlighting and dot highlighting.
7. The three-variable scatter plot (GDP × GII × wage gap) simultaneously displays three variables:
   X-axis: Gross Domestic Product
   Y-axis: Gender Inequality Index
   Dot color: Wage gap (using 9-color scale)
