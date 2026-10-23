// ============================================
// TUTORIAL 8: STUDENT WORK FILE
// Complete the three library integration examples
// ============================================

import {
    handleAnimationError,
    getRestaurantCoordinates,
    handleMapError,
    handleChartError,
    createRestaurantCards,
    clearExistingMap,
    restaurants,
    clickToLoad
 } from './tutorial-support.js';

// Global variables for your library instances
let myChart = null;
let myMap = null;

// Wait for page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Tutorial 8: Student work file ready!');
    
    // Set up your event listeners
    // Set up event listeners - note the arrow function to pass the button
    document.querySelector('#load-data-button').addEventListener('click', function(event) {
        clickToLoad(event.target); // Pass the button that was clicked
    });
    document.querySelector('#chart-button').addEventListener('click', createMyChart);
    document.querySelector('#map-button').addEventListener('click', createMyMap);
    document.querySelector('#animation-button').addEventListener('click', animateMyCards);
});

// ============================================
// EXAMPLE 1: CHART.JS - YOU COMPLETE THIS
// ============================================

function createMyChart() {
    // Step 1: Check if Chart.js is available (you write this)
    if (typeof Chart === 'undefined') {
        alert('Chart.js not available. Check console.');
        return;
    }

    if (restaurants.length === 0) {
        alert('No data loaded. Click "Load Data" first.');
        return;
    }
    
    // Step 2: Process the restaurant data for charting
    // You need to count how many restaurants of each cuisine type there are
    const cuisineCounts = {};
    restaurants.forEach(function(restaurant) {
        // TODO: Count restaurants by cuisine type
        // Hint: restaurant.cuisine is the field you want
        // Hint: cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;
    });
    
    // Step 3: Transform counts into Chart.js format using array methods
    // const chartLabels = /* TODO: Get the cuisine types (keys) */;
    // const chartData = /* TODO: Get the counts (values) */;
    
    console.log('Chart data prepared:', { labels: chartLabels, data: chartData });
    
    try {
        // Step 4: Get canvas and clear existing chart (provided)
        const canvas = document.querySelector('#restaurant-chart');
        const ctx = canvas.getContext('2d');
        
        if (myChart) {
            myChart.destroy();
            myChart = null;
        }
        
        // Step 5: Create the Chart.js chart (you complete the config)
        // options for charts: https://www.chartjs.org/docs/latest/charts/
        myChart = new Chart(ctx, {
            /* TODO: What type of chart? 'bar', 'pie', 'line'? */
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    /* TODO: adjust this name */
                    label: 'name-of-series',
                    data: chartData,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 205, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)',
                        'rgba(255, 159, 64, 0.6)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'title your chart please'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'a real y axis has a label'
                        }
                    }
                }
            }
        });
        
        console.log('Chart created successfully!');
        
    } catch (error) {
        handleChartError(error); // Error handling provided in support file
    }
}

// ============================================
// EXAMPLE 2: LEAFLET.JS - YOU COMPLETE THIS
// ============================================

function createMyMap() {
    // Step 1: Check if Leaflet is available
    if (typeof L === 'undefined') {
        alert('Leaflet.js not available. Check console.');
        return;
    }

    if (restaurants.length === 0) {
        alert('No data loaded. Click "Load Data" first.');
        return;
    }
    
    try {
        // Step 2: Clear existing map (provided)
        clearExistingMap(); // Function provided in support file
        
        // Step 3: Create the map (provided)
        myMap = L.map('restaurant-map').setView([38.9897, -76.9378], 12);
        
        // Step 4: Add map tiles (provided)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(myMap);
        
        // Step 5: Add markers for restaurants (you complete this part)
        restaurants.forEach(function(restaurant, index) {
            // Get coordinates (function provided in support file)
            const coords = getRestaurantCoordinates(restaurant, index);
            
            // TODO: Create a marker at the coordinates
            const marker = L.marker(coords);
            
            // TODO: Create popup content with restaurant information
            /* TODO: Build HTML string using restaurant.name, restaurant.cuisine, restaurant.rating */;
            // const popupContent = ...;
            
            // TODO: Bind the popup to the marker and add to map
            marker.bindPopup(popupContent).addTo(myMap);
        });
        
        console.log('Map created successfully!');
        
    } catch (error) {
        handleMapError(error); // Error handling provided in support file
    }
}

// ============================================
// EXAMPLE 3: GSAP - YOU COMPLETE THIS
// ============================================

function animateMyCards() {
    // Step 1: Check if GSAP is available
    if (typeof gsap === 'undefined') {
        alert('GSAP not available. Check console.');
        return;
    }

    if (restaurants.length === 0) {
        alert('No data loaded. Click "Load Data" first.');
        return;
    }
    
    try {
        // Step 2: Clear and create cards (provided)
        createRestaurantCards(); // Function provided in support file
        
        // Step 3: Create your animation sequence
        // TODO: Animate the .restaurant-card elements
        // Make them start invisible and small, then appear with a bounce
        
        gsap.fromTo('.restaurant-card', 
            // FROM state (starting point)
            {
                /* TODO: Starting properties - opacity, scale, y position? */
            },
            // TO state (ending point)  
            {
                /* TODO: Ending properties - make them fully visible and normal size */
                duration: '0.2'
                // stagger: /* TODO: Delay between each card? 0.1 seconds? */,
                // ease: /* TODO: What kind of easing? "bounce.out"? */
            }
        );
        
        console.log('Animation created successfully!');
        
    } catch (error) {
        handleAnimationError(error); // Error handling provided in support file
    }
}

// ============================================
// DEBUGGING HELPERS (for your console)
// ============================================

function testMyWork() {
    console.log('Testing your implementations...');
    
    if (restaurants.length > 0) {
        console.log('Data loaded:', restaurants.length, 'restaurants');
        
        // Test each function
        console.log('Testing Chart.js...');
        createMyChart();
        
        setTimeout(() => {
            console.log('Testing Leaflet.js...');
            createMyMap();
            
            setTimeout(() => {
                console.log('Testing GSAP...');
                animateMyCards();
            }, 1000);
        }, 1000);
    } else {
        console.log('No restaurant data loaded. Make sure tutorial-support.js is included.');
    }
}

// Call testMyWork() in the console to test all your implementations