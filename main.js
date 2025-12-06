
let currentMetric = "gdp";
let selectedCountry = null;
let hoveredCountry = null;
let geoLayer = null;
let currentGeoData = null;


const tooltip = d3.select("body")
    .append("div")
    .attr("class", "custom-tooltip")
    .style("opacity", 0);



const map = L.map("map").setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 7
}).addTo(map);


const svgLayer = L.svg().addTo(map);
const svgDefs = d3.select("#map").select("svg").append("defs");

svgDefs.append("filter")
    .attr("id", "glow-filter")
    .html(`
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    `);



Promise.all([
    d3.csv("GDP_inequality.csv"),
    d3.json("world_countries.geojson")
]).then(([csvData, geoData]) => {

    geoData.features.forEach(f => {
        const iso = f.properties["ISO3166-1-Alpha-3"];
        const row = csvData.find(r => r.iso_a3 === iso);

        if (row) {
            f.properties.country = row.country;
            f.properties.gdp = +row.GDP || null;
            f.properties.inequality = +row["Inequality index"] || null;
            f.properties.wage_gap = +row.wage_gap || null;
        }
    });

    currentGeoData = geoData;

    drawMap(geoData);
    drawScatter(geoData);
    setupButtons();
    fillCountryList(geoData);
});



document.body.addEventListener("click", (e) => {
    if (["circle", "path", "BUTTON"].includes(e.target.tagName)) return;

    selectedCountry = null;
    hoveredCountry = null;

    tooltip.style("opacity", 0);

    document.getElementById("container").style.display = "flex";
    document.getElementById("triple-container").style.display = "none";
    document.getElementById("country-title").style.display = "block";
    document.getElementById("country-list").style.display = "block";

    drawMap(currentGeoData);
    drawScatter(currentGeoData);
    applyScatterHighlight();
});




function drawMap(geoData) {

    if (geoLayer) geoLayer.remove();

    geoLayer = L.geoJSON(geoData, {


        filter: feature => {
            const p = feature.properties;
            return (
                p.gdp != null ||
                p.inequality != null ||
                p.wage_gap != null
            );
        },

        style: feature => mapStyle(feature.properties),

        onEachFeature: (feature, layer) => {

            const p = feature.properties;

            layer.on("mouseover", e => {
                hoveredCountry = p.country;

                drawScatter(currentGeoData);
                drawTripleHighlight();

                layer.setStyle(highlightMapStyle(p));
                layer._path.classList.add("glow-path");

                tooltip.style("opacity", 1)
                    .html(`
                        <b>${p.country}</b><br>
                        ${currentMetric === "gdp" ? "GDP" : "Inequality index"}：${p[currentMetric]}<br>
                        wage_gap：${p.wage_gap ?? "no data"}
                    `)
                    .style("left", e.originalEvent.pageX + 15 + "px")
                    .style("top", e.originalEvent.pageY - 15 + "px");

                applyScatterHighlight();
            });

            layer.on("mouseout", () => {
                hoveredCountry = null;
                tooltip.style("opacity", 0);

                layer._path.classList.remove("glow-path");

                drawMap(currentGeoData);
                drawScatter(currentGeoData);
                drawTripleHighlight();
                applyScatterHighlight();
            });

            layer.on("click", e => {
                L.DomEvent.stopPropagation(e);

                selectedCountry = p.country;
                hoveredCountry = null;

                drawMap(currentGeoData);
                drawScatter(currentGeoData);
                drawTripleHighlight();
                applyScatterHighlight();

                highlightCountryButton(p.country);
            });
        }
    }).addTo(map);

    addLegend();
}




function mapStyle(p) {
    if (!p[currentMetric]) return {fillOpacity: 0};

    const baseColor = currentMetric === "gdp" ? gdpColor(p.gdp) : inequalityColor(p.inequality);

    if (selectedCountry === p.country)
        return { fillColor: "green", color: "#000", weight: 3, fillOpacity: 1 };

    if (hoveredCountry === p.country)
        return { fillColor: baseColor, color: "#000", weight: 3, fillOpacity: 1 };

    if (selectedCountry || hoveredCountry)
        return { fillColor: baseColor, color: "#666", weight: 1, fillOpacity: 0.3 };

    return { fillColor: baseColor, color: "#666", weight: 1, fillOpacity: 0.85 };
}

function highlightMapStyle(p) {
    return {
        fillColor: currentMetric === "gdp" ? gdpColor(p.gdp) : inequalityColor(p.inequality),
        color: "#000",
        weight: 3,
        fillOpacity: 1
    };
}




function fillCountryList(geoData) {
    const container = d3.select("#country-list").html("");

    const names = geoData.features
        .filter(f => f.properties.wage_gap != null)
        .map(f => f.properties.country)
        .sort((a, b) => a.localeCompare(b));

    names.forEach(name => {
        container.append("button")
            .text(name)
            .on("click", () => {

                selectedCountry = name;
                hoveredCountry = null;

                highlightCountryButton(name);

                drawMap(currentGeoData);
                drawScatter(currentGeoData);
                drawTripleHighlight();
                applyScatterHighlight();
            });
    });
}

function highlightCountryButton(name) {
    d3.selectAll("#country-list button").classed("active", false);
    d3.selectAll("#country-list button")
        .filter(function () { return this.textContent === name; })
        .classed("active", true);
}




function drawScatter(geoData) {

    const svg = d3.select("#scatter");
    svg.selectAll("*").remove();

    const margin = {top: 40, right: 30, bottom: 60, left: 70};
    const w = +svg.attr("width") - margin.left - margin.right;
    const h = +svg.attr("height") - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = geoData.features
        .map(f => f.properties)
        .filter(p => p[currentMetric] != null && p.wage_gap != null);

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.wage_gap)).nice()
        .range([0, w]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d[currentMetric])).nice()
        .range([h, 0]);

    g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x));
    g.append("g").call(d3.axisLeft(y));


    const rScale = d3.scaleSqrt()
        .domain(d3.extent(data, d => d.wage_gap))
        .range([5, 10]);


    const circles = g.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.wage_gap))
        .attr("cy", d => y(d[currentMetric]))
        .attr("r", 0)
        .style("opacity", 0)
        .attr("fill", "#007bff")
        .attr("stroke", "black")
        .transition()
        .duration(700)
        .attr("r", d => rScale(d.wage_gap))
        .style("opacity", 0.9);


    g.selectAll("circle")
        .on("mouseover", (event, d) => {
            hoveredCountry = d.country;

            drawMap(currentGeoData);
            drawTripleHighlight();

            tooltip.style("opacity", 1)
                .html(`
                    <b>${d.country}</b><br>
                    wage_gap：${d.wage_gap}<br>
                    ${currentMetric === "gdp" ? "GDP" : "Inequality index"}：${d[currentMetric]}
                `)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 12 + "px");

            applyScatterHighlight();
        })

        .on("mousemove", event =>
            tooltip.style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 12 + "px")
        )

        .on("mouseout", () => {
            hoveredCountry = null;
            tooltip.style("opacity", 0);
            drawMap(currentGeoData);
            drawTripleHighlight();
            applyScatterHighlight();
        })

        .on("click", (event, d) => {
            event.stopPropagation();
            selectedCountry = d.country;
            hoveredCountry = null;

            highlightCountryButton(d.country);

            drawMap(currentGeoData);
            drawScatter(currentGeoData);
            drawTripleHighlight();
            applyScatterHighlight();
        });



    drawTrendLine(g, data, x, y);
}



function drawTrendLine(g, data, x, y) {

    if (data.length < 2) return;

    const xVals = data.map(d => d.wage_gap);
    const yVals = data.map(d => d[currentMetric]);

    const lr = linearRegression(xVals, yVals);

    const xRange = d3.extent(xVals);
    const yRange = xRange.map(x => lr.slope * x + lr.intercept);

    g.append("line")
        .attr("x1", x(xRange[0]))
        .attr("y1", y(yRange[0]))
        .attr("x2", x(xRange[1]))
        .attr("y2", y(yRange[1]))
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("opacity", 0.8);
}




function linearRegression(x, y) {
    const n = x.length;
    const sumX = d3.sum(x);
    const sumY = d3.sum(y);
    const sumXY = d3.sum(x.map((d, i) => d * y[i]));
    const sumX2 = d3.sum(x.map(d => d * d));

    const slope = (n * sumXY - sumX * sumY) /
        (n * sumX2 - sumX * sumX);

    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}




const tol9colors = [
    "#332288","#88CCEE","#44AA99","#117733",
    "#999933","#DDCC77","#CC6677","#882255","#AA4499"
];

function drawTripleScatter(geoData) {

    const svg = d3.select("#triple-scatter");
    svg.selectAll("*").remove();

    const margin = {top: 60, right: 30, bottom: 70, left: 80};
    const w = +svg.attr("width") - margin.left - margin.right;
    const h = +svg.attr("height") - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = geoData.features
        .map(f => f.properties)
        .filter(p => p.gdp != null && p.inequality != null && p.wage_gap != null);


    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.gdp)).nice()
        .range([0, w]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.inequality)).nice()
        .range([h, 0]);


    g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x));
    g.append("g").call(d3.axisLeft(y));

    g.append("text")
        .attr("x", w / 2)
        .attr("y", h + 50)
        .attr("text-anchor", "middle")
        .text("GDP");

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -h / 2)
        .attr("y", -55)
        .attr("text-anchor", "middle")
        .text("Inequality index");



    const minGap = d3.min(data, d => d.wage_gap);
    const maxGap = d3.max(data, d => d.wage_gap);

    const colorScale = d3.scaleLinear()
        .domain(d3.range(0, 1.0001, 1/8).map(t => minGap + t * (maxGap - minGap)))
        .range(tol9colors);



    const circles = g.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.gdp))
        .attr("cy", d => y(d.inequality))
        .attr("r", 0)
        .style("opacity", 0)
        .attr("fill", d => colorScale(d.wage_gap))
        .attr("stroke", "black")
        .transition()
        .duration(800)
        .attr("r", 7)
        .style("opacity", 0.9);

    g.selectAll("circle")

        .on("mouseover", (event, d) => {
            hoveredCountry = d.country;

            drawMap(currentGeoData);
            drawScatter(currentGeoData);

            tooltip.style("opacity", 1)
                .html(`
                    <b>${d.country}</b><br>
                    GDP：${d.gdp}<br>
                    Ineuality index：${d.inequality}<br>
                    wage_gap：${d.wage_gap}
                    
                `)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 12 + "px");

            applyScatterHighlight();
        })

        .on("mouseout", () => {
            hoveredCountry = null;
            tooltip.style("opacity", 0);

            drawMap(currentGeoData);
            drawScatter(currentGeoData);
            applyScatterHighlight();
        })

        .on("click", (event, d) => {
            event.stopPropagation();

            selectedCountry = d.country;
            hoveredCountry = null;

            drawMap(currentGeoData);
            drawScatter(currentGeoData);
            drawTripleScatter(currentGeoData);
            applyScatterHighlight();

            highlightCountryButton(d.country);
        });

    addTripleLegend(minGap, maxGap);
}




function addTripleLegend(minGap, maxGap) {
    const box = d3.select("#triple-right-legend").html("");

    box.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .text("Salary gap color band");

    box.append("div").attr("class", "triple-legend-bar");

    box.append("div")
        .style("margin-top", "10px")
        .html(`
            <b>Lowest：</b> ${minGap}<br>
            <b>Highest：</b> ${maxGap}
        `);
}




function drawTripleHighlight() {
    const svg = d3.select("#triple-scatter");

    svg.selectAll("circle")
        .attr("stroke-width", d =>
            selectedCountry === d.country ? 3 :
                hoveredCountry === d.country ? 2 : 1
        )
        .style("opacity", d =>
            selectedCountry ? (d.country === selectedCountry ? 1 : 0.25) :
                hoveredCountry ? (d.country === hoveredCountry ? 1 : 0.25) :
                    0.9
        );
}




function applyScatterHighlight() {


    d3.select("#scatter").selectAll("circle")
        .transition().duration(200)
        .attr("fill", d =>
            (selectedCountry === d.country || hoveredCountry === d.country)
                ? "red"
                : "#007bff"
        )
        .attr("r", d =>
            (selectedCountry === d.country || hoveredCountry === d.country)
                ? 12
                : 6
        )
        .style("opacity", d =>
            selectedCountry
                ? (d.country === selectedCountry ? 1.0 : 0.25)
                : hoveredCountry
                    ? (d.country === hoveredCountry ? 1.0 : 0.25)
                    : 0.9
        )
        .attr("stroke-width", d =>
            selectedCountry === d.country ? 3 :
                hoveredCountry === d.country ? 2 : 1
        );


    d3.select("#triple-scatter").selectAll("circle")
        .transition().duration(200)
        .attr("fill", d =>
            (selectedCountry === d.country || hoveredCountry === d.country)
                ? "red"
                : d3.select(this).attr("original_fill")
        )
        .attr("r", d =>
            (selectedCountry === d.country || hoveredCountry === d.country)
                ? 12
                : 7
        )
        .style("opacity", d =>
            selectedCountry
                ? (d.country === selectedCountry ? 1.0 : 0.25)
                : hoveredCountry
                    ? (d.country === hoveredCountry ? 1.0 : 0.25)
                    : 0.9
        )
        .attr("stroke-width", d =>
            selectedCountry === d.country ? 3 :
                hoveredCountry === d.country ? 2 : 1
        );
}




function addLegend() {

    d3.select(".legend-box").remove();

    const box = d3.select("#map")
        .append("div")
        .attr("class", "legend-box");

    box.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "8px")
        .text(currentMetric === "gdp" ? "GDP（US）" : "Inequality index");

    const ranges = currentMetric === "gdp"
        ? [1000,5000,10000,20000,50000]
        : [0.1,0.2,0.3,0.4,0.5];

    const colors = currentMetric === "gdp"
        ? ["#deebf7","#c6dbef","#9ecae1","#6baed6","#2171b5"]
        : ["#FEB24C","#FD8D3C","#FC4E2A","#E31A1C","#BD0026"];

    for (let i = 0; i < ranges.length; i++) {
        const row = box.append("div").attr("class", "legend-row");

        row.append("div")
            .attr("class", "legend-color")
            .style("background", colors[i]);

        row.append("span")
            .text(
                i < ranges.length - 1
                    ? `${ranges[i]} - ${ranges[i+1]}`
                    : `${ranges[i]}+`
            );
    }
}




function setupButtons() {

    d3.select("#btn-gdp").on("click", () => {
        currentMetric = "gdp";
        selectedCountry = null;
        hoveredCountry = null;

        document.getElementById("container").style.display = "flex";
        document.getElementById("triple-container").style.display = "none";
        document.getElementById("country-title").style.display = "block";
        document.getElementById("country-list").style.display = "block";

        drawMap(currentGeoData);
        drawScatter(currentGeoData);
        updateButtonUI();
    });

    d3.select("#btn-ineq").on("click", () => {
        currentMetric = "inequality";
        selectedCountry = null;
        hoveredCountry = null;

        document.getElementById("container").style.display = "flex";
        document.getElementById("triple-container").style.display = "none";
        document.getElementById("country-title").style.display = "block";
        document.getElementById("country-list").style.display = "block";

        drawMap(currentGeoData);
        drawScatter(currentGeoData);
        updateButtonUI();
    });

    d3.select("#btn-3var").on("click", () => {
        selectedCountry = null;
        hoveredCountry = null;

        document.getElementById("container").style.display = "none";
        document.getElementById("triple-container").style.display = "block";
        document.getElementById("country-title").style.display = "none";
        document.getElementById("country-list").style.display = "none";

        tooltip.style("opacity", 0);
        drawTripleScatter(currentGeoData);
    });
}




function updateButtonUI() {
    d3.selectAll(".controls button").classed("active", false);

    if (currentMetric === "gdp")
        d3.select("#btn-gdp").classed("active", true);
    else
        d3.select("#btn-ineq").classed("active", true);

    d3.select("#scatter-title").text(
        currentMetric === "gdp" ? "wage_gap vs GDP" : "wage_gap vs Inequality index"
    );
}




function gdpColor(v){
    return v > 50000 ? "#08306b" :
        v > 30000 ? "#2171b5" :
            v > 10000 ? "#6baed6" :
                v > 5000  ? "#9ecae1" :
                    v > 1000  ? "#c6dbef" :
                        "#deebf7";
}


function inequalityColor(v){
    return v > 0.6 ? "#800026" :
        v > 0.5 ? "#BD0026" :
            v > 0.4 ? "#E31A1C" :
                v > 0.3 ? "#FC4E2A" :
                    v > 0.2 ? "#FD8D3C" :
                        "#FEB24C";
}
