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
        // Count restaurants by cuisine type
        const cuisine = restaurant.cuisine || 'Unknown';
        cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;
    });
    
    // Step 3: Transform counts into Chart.js format using array methods
    const chartLabels = Object.keys(cuisineCounts);   // cuisine types
    const chartData = Object.values(cuisineCounts);   // counts
    
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
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Number of Restaurants',
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
                        text: 'Restaurants by Cuisine Type'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Restaurants'
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
        
        // Step 5: Filter data for the map - keep only restaurants with a usable location
        const mappableRestaurants = restaurants.filter(function(restaurant) {
            return restaurant.neighborhood && restaurant.neighborhood !== 'Unknown';
        });

        if (mappableRestaurants.length === 0) {
            throw new Error('No restaurants with location data to map');
        }

        const markers = L.featureGroup();

        mappableRestaurants.forEach(function(restaurant, index) {
            // Get coordinates (function provided in support file)
            const coords = getRestaurantCoordinates(restaurant, index);
            
            // Create a marker at the coordinates
            const marker = L.marker(coords);
            
            // Popup content with restaurant information
            const popupContent = `
                <div style="text-align: center;">
                    <strong>${restaurant.name || 'Unknown Restaurant'}</strong><br>
                    <em>${restaurant.cuisine || 'Unknown'} cuisine</em><br>
                    Rating: ${restaurant.rating || 'N/A'}★<br>
                    <small>${restaurant.neighborhood}</small>
                </div>
            `;
            
            // Bind the popup to the marker and add it to the marker group
            marker.bindPopup(popupContent);
            markers.addLayer(marker);
        });

        // Add all markers to the map and zoom to fit them
        myMap.addLayer(markers);
        myMap.fitBounds(markers.getBounds(), { padding: [30, 30] });
        
        console.log(`Map created with ${mappableRestaurants.length} restaurants!`);
        
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
                opacity: 0,
                scale: 0.8,
                y: 50
            },
            // TO state (ending point)  
            {
                opacity: 1,
                scale: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.15,
                ease: 'back.out(1.7)'
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
window.testMyWork = testMyWork;