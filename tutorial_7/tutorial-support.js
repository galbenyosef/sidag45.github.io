// ============================================
// TUTORIAL 8: SUPPORT FUNCTIONS
// Infrastructure code - students import this
// ============================================

// Global restaurant data storage
export let restaurants = [];

export function setRestaurants(data) {
    restaurants = data;
}

// ============================================
// DATA LOADING AND SETUP
// ============================================

export async function loadRestaurantDataAndSetup() {
    console.log('Loading restaurant data...');
    
    try {
        // TODO Load the restaurant data
        const response = await fetch('restaurants.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setRestaurants(data);
        
        console.log(`Loaded ${data.length} restaurants`);
        
        // Checking library status
        checkAllLibraryStatus();
        
        // Show the interface
        showTutorialInterface();
        
    } catch (error) {
        console.error('Failed to load restaurant data:', error);
        showLoadingError();
    }
}


export function checkAllLibraryStatus() {
    console.log('=== Library Status Check ===');
    
    const libraries = [
        { name: 'Chart.js', check: () => typeof Chart !== 'undefined', selector: '#chart-status' },
        { name: 'Leaflet.js', check: () => typeof L !== 'undefined', selector: '#leaflet-status' },
        { name: 'GSAP', check: () => typeof gsap !== 'undefined', selector: '#gsap-status' }
    ];
    
    const loadedCount = libraries.reduce((count, lib) => {
        const element = document.querySelector(lib.selector);
        const isLoaded = lib.check();
        
        element.textContent = isLoaded ? 'Loaded' : 'Failed';
        element.className = isLoaded ? 'status-loaded' : 'status-failed';
        console.log(`${lib.name}: ${isLoaded ? 'Available' : 'Not available'}`);
        
        return count + (isLoaded ? 1 : 0);
    }, 0);
    
    console.log('============================');

    // Hide examples section if no libraries loaded
    const examplesSection = document.querySelector('#examples-section');
    if (loadedCount === 0 && examplesSection) {
        examplesSection.style.display = 'none';
        console.log('No libraries loaded - hiding examples section');
    }

    return loadedCount;
}


export function showTutorialInterface() {
    // Show all the hidden sections
    const sections = [
        '#library-status-section',
        '#examples-section', 
        '#pattern-summary',
        '#assignment-planning'
    ];
    
    sections.forEach(function(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.classList.remove('hidden');
        }
    });
}

export function showLoadingError() {
    const statusDisplay = document.querySelector('#loading-status');
    if (statusDisplay) {
        statusDisplay.innerHTML = `
            <div class="status-display error">
                <p class="status-message">Failed to load restaurant data. Check console for details.</p>
            </div>
        `;
    }
}

// ============================================
// CHART.JS SUPPORT FUNCTIONS
// ============================================

export function handleChartError(error) {
    console.error('Chart creation failed:', error);
    
    // Show error in canvas
    const canvas = document.querySelector('#restaurant-chart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f8d7da';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#721c24';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Chart creation failed', canvas.width/2, canvas.height/2 - 10);
        ctx.fillText('Check console for details', canvas.width/2, canvas.height/2 + 15);
    }
}

// ============================================
// LEAFLET.JS SUPPORT FUNCTIONS  
// ============================================

export function clearExistingMap() {
    const mapContainer = document.querySelector('#restaurant-map');
    if (window.myMap) {
        window.myMap.remove();
        window.myMap = null;
    }
    if (mapContainer) {
        mapContainer.innerHTML = '';
    }
}

export function getRestaurantCoordinates(restaurant, index) {
    // Simulate coordinates based on neighborhood
    // This is the "tricky part" that would take students hours to figure out
    const neighborhoodCoords = {
        'College Park': [38.9897, -76.9378],
        'Downtown': [38.9067, -76.9078],
        'University District': [38.9800, -76.9400],
        'Historic District': [38.9850, -76.9350]
    };
    
    const baseCoords = neighborhoodCoords[restaurant.neighborhood] || [38.9897, -76.9378];
    
    // Add small random offset to avoid overlapping markers
    const lat = baseCoords[0] + (Math.random() - 0.5) * 0.01;
    const lng = baseCoords[1] + (Math.random() - 0.5) * 0.01;
    
    return [lat, lng];
}

export function handleMapError(error) {
    console.error('Map creation failed:', error);
    
    // Show error message in map container
    const mapContainer = document.querySelector('#restaurant-map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div style="color: #721c24; text-align: center; padding: 2rem; border: 2px dashed #f8d7da; border-radius: 0.5rem; background: #f8d7da;">
                <strong>Map creation failed</strong><br>
                <small>Check console for details</small>
            </div>
        `;
    }
}

// ============================================
// GSAP SUPPORT FUNCTIONS
// ============================================

export function createRestaurantCards() {
    const cardsContainer = document.querySelector('#restaurant-cards');
    if (!cardsContainer) return;
    
    // Clear existing cards
    cardsContainer.innerHTML = '';
    
    // Create cards for first 6 restaurants
    const displayRestaurants = restaurants.slice(0, 6);
    
    displayRestaurants.forEach(function(restaurant) {
        const card = document.createElement('div');
        card.className = 'restaurant-card';
        card.innerHTML = `
            <h4>${restaurant.name || 'Unknown Restaurant'}</h4>
            <p class="restaurant-cuisine">${restaurant.cuisine || 'Unknown'} cuisine</p>
            <p class="restaurant-rating">Rating: ${restaurant.rating || 'N/A'}★</p>
            <p class="restaurant-location">${restaurant.neighborhood || 'Unknown location'}</p>
        `;
        cardsContainer.appendChild(card);
    });
}

export function handleAnimationError(error) {
    console.error('Animation creation failed:', error);
    
    // Show cards without animation as fallback
    createRestaurantCards();
    
    // Make them visible
    document.querySelectorAll('.restaurant-card').forEach(function(card) {
        card.style.opacity = '1';
    });
    
    // Add error message to first card
    const firstCard = document.querySelector('.restaurant-card');
    if (firstCard) {
        const errorMsg = document.createElement('p');
        errorMsg.style.color = '#dc3545';
        errorMsg.style.fontSize = '0.8rem';
        errorMsg.textContent = 'Animation failed - showing static version';
        firstCard.appendChild(errorMsg);
    }
}

// ============================================
// DEBUGGING UTILITIES
// ============================================

export function checkStudentProgress() {
    console.log('=== Student Progress Check ===');
    console.log('Restaurants loaded:', restaurants.length);
    
    // Check if they have global variables defined
    console.log('Student variables defined:');
    console.log('- myChart:', typeof window.myChart);
    console.log('- myMap:', typeof window.myMap);
    
    // Check if their functions exist
    console.log('Student functions defined:');
    console.log('- createMyChart:', typeof createMyChart);
    console.log('- createMyMap:', typeof createMyMap); 
    console.log('- animateMyCards:', typeof animateMyCards);
    
    console.log('==============================');
}

export function resetTutorial() {
    console.log('Resetting tutorial state...');
    
    // Clear chart
    if (window.myChart) {
        window.myChart.destroy();
        window.myChart = null;
    }
    
    // Clear map
    clearExistingMap();
    
    // Clear cards
    const cardsContainer = document.querySelector('#restaurant-cards');
    if (cardsContainer) {
        cardsContainer.innerHTML = '';
    }
    
    console.log('Tutorial reset complete');
}

// ============================================
// ASYNC FUNCTIONS
// ============================================

export async function clickToLoad(targetButton) {
    // Get DOM elements when function runs, not when module loads
    const statusDisplay = document.querySelector('#loading-status');
    const statusMessage = statusDisplay.querySelector('.status-message');
    
    if (!statusDisplay || !statusMessage) {
        console.error('Could not find status display elements');
        return;
    }
    
    // Show loading state
    statusDisplay.classList.remove('success', 'error');
    statusDisplay.classList.add('loading');
    statusMessage.textContent = 'Loading restaurant data...';
    targetButton.disabled = true;
    
    console.log('Loading restaurant data from restaurants.json...');
    
    try {
        const response = await fetch('restaurants.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update the global variable
        setRestaurants(data);
        
        console.log(`Successfully loaded ${data.length} restaurants`);
        
        // Show success state
        statusDisplay.classList.remove('loading');
        statusDisplay.classList.add('success');
        statusMessage.textContent = `Successfully loaded ${data.length} restaurants!`;
        
        // Checking library status
        checkAllLibraryStatus();
        
        showTutorialInterface();
        
        targetButton.textContent = 'Reload Data';
        targetButton.disabled = false;
        
    } catch (error) {
        console.error('Failed to load restaurant data:', error);
        
        statusDisplay.classList.remove('loading');
        statusDisplay.classList.add('error');
        statusMessage.textContent = 'Failed to load data. Check console for details.';
        
        targetButton.disabled = false;
        targetButton.textContent = 'Try Again';
    }
}

// Make key functions available globally for debugging
window.checkStudentProgress = checkStudentProgress;
window.resetTutorial = resetTutorial;

console.log('Tutorial 8 support functions loaded');
console.log('Available debugging functions: checkStudentProgress(), resetTutorial()');