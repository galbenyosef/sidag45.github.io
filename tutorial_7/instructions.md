 Tutorial 8: Library Integration Patterns

This tutorial demonstrates the universal pattern for integrating external JavaScript libraries into web applications. You will see three working examples using the same restaurant dataset, understand the common integration steps, and prepare for choosing one library to enhance your Assignment 2 project.

#### Learning Objectives
By completing this tutorial, you will understand:
- The universal CDN → Check → Process → Initialize → Error Handling pattern
- How the same data can be enhanced by different libraries for different purposes  
- What Chart.js, Leaflet.js, and GSAP can do for typical datasets
- How to evaluate which library best fits your Assignment 2 project
- Professional workflows for adding external dependencies

#### Prerequisites
- Completed Tutorial 6 (async data loading)
- Completed Tutorial 7 (multiple data presentations)
- Working Assignment 2 with four data views

#### Steps:

1. Data Loading Review
    - Load restaurant data using familiar async/await patterns from Tutorial 6
    - Understand why we start with our existing data before adding libraries

2. Library Status Verification
    - Learn the critical first step: checking if external libraries loaded successfully
    - Understand graceful degradation when libraries fail
    - See how professional developers handle external dependencies

3. Three Working Demonstrations

**Chart.js Example: Data Visualization**
- Transform restaurant cuisine data into an interactive bar chart
- Pattern: `new Chart(canvas, { type: 'bar', data: processedData })`
- Best for: numerical data, statistics, comparisons, trends

**Leaflet.js Example: Geographic Display**
- Display restaurant locations on an interactive map with popups  
- Pattern: `L.map(element).addLayer(markers)`
- Best for: location data, addresses, spatial patterns

**GSAP Example: Smooth Animations**
- Animate restaurant cards with professional transitions
- Pattern: `gsap.fromTo(elements, fromState, toState)`
- Best for: animations too complex to easily handle with CSS3 animations

#### Why This Matters for Project Management:
- External libraries add both capability and risk to projects
- Integration patterns reduce development time but increase complexity
- Understanding library trade-offs helps with technology selection decisions
- Graceful degradation prevents single points of failure

**Required Reading:**
- [MDN: Using External Libraries](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Client-side_web_APIs/Third_party_APIs)

**Library Documentation (for reference):**
- [Chart.js Getting Started](https://www.chartjs.org/docs/latest/getting-started/)
- [Leaflet Quick Start Guide](https://leafletjs.com/examples/quick-start/)
- [GSAP Getting Started](https://greensock.com/get-started/)

**Debugging Resources:**
- Browser Developer Tools Console tab
- [Common CDN Issues](https://cdnjs.com/about) 
- Network tab for checking library loading failures

#### Project 2 Preparation
After seeing all three examples, you'll choose ONE library to enhance your Assignment 2:

**Choose Chart.js if your data has:**
- Numerical values that could be compared or visualized
- Categories that could be counted or analyzed
- Time-based data that could show trends
- Statistical information users need to understand quickly

**Choose Leaflet.js if your data has:**
- Location information (addresses, cities, coordinates)
- Geographic relationships that matter to users
- Spatial patterns that aren't obvious in other views
- Users who need to understand "where" as much as "what"

#### Submission
- Submit a working link to your code showing all three libraries working
