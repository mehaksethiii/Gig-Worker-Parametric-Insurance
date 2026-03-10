# AI POWERED INSURANCE FOR GIG ECONOMY

1. PROBLEM STATEMENT
Platform-based delivery workers from companies like Zomato and Swiggy are a key part of India's digital economy. However, they frequently lose income due to external disruptions such as heavy rainfall, natural disasters, extreme heat, pollution, or local restrictions.
These events can reduce their working hours and cause 20–30% loss in weekly income, while gig workers currently have no protection against such uncontrollable disruptions.
This project proposes an AI-powered parametric insurance platform that automatically compensates delivery workers when such disruption events occur.

Target Persona- Food Delivery Riders (Delivery partners working with Zomato and Swiggy )

2. PERSONA BASED REAL TIME SCENARIO -
Ishan usually works 8 hours per day and earns around ₹100–₹120 per hour from deliveries.One evening, heavy rainfall (>50 mm) occurs in his area, which forces restaurants to close early and roads to flood. Ishan is unable to work for 4 hours, resulting in an income loss of about ₹480.

Solution of the Scenario
Ishan had subscribed to the platform’s ₹30 weekly insurance plan earlier.The system continuously monitors weather data using APIs. When the rainfall threshold is crossed, a parametric trigger activates automatically.
The platform verifies Ishan’s location and delivery activity to prevent fraud.
The system calculates Ishan’s estimated lost income and instantly transfers the payout (₹480) to his digital wallet or bank account.
This ensures Ishan receives financial protection without filing any manual claim. 

Our Solution
We propose an AI-enabled parametric insurance platform that:
• Provides weekly subscription insurance plans
• Monitors real-time disruption data (weather, pollution, etc.)
• Automatically triggers claims when conditions are met
• Instantly pays compensation for lost income
No manual claim filing is required.

3. Parametric Disruption Triggers
The system continuously monitors external conditions.
Disruption	Trigger
Heavy Rain	Rainfall > 50 mm
Extreme Heat	Temperature > 42°C
Severe Pollution	AQI > 400
Curfew / Local Restrictions	Government restrictions
When these thresholds are crossed, the system automatically triggers compensation.


Weekly Pricing Model

The insurance follows a weekly subscription model aligned with gig worker earning cycles.
Plan	    Weekly Premium	    Max Weekly Payout
Basic	          ₹20	              ₹500
Standard	      ₹30	              ₹750
Premium	        ₹40	              ₹1000

Example
If rainfall stops deliveries for 4 hours:
Lost Income = 4 × ₹120 = ₹480
The system automatically pays ₹480 to the rider.

4.   Justifying choice between web or app-
   Easy accessibility, faster development & deployment, cost efficiency  n, Simpler Integration with APIs make it a better choice  for Prototype demonstration.

7. Platform Architecture & Tech Stack

Frontend - React.js
Backend - Node.js + Express
AI / ML - Python, Scikit-learn
Database - MongoDB
API - Weather data via OpenWeatherMap
     Air quality monitoring via AQICN
Payments - Razorpay (sandbox)

8. (a) AI / ML Integration
Machine learning models analyze:
• Historical weather data
• City-level disruption patterns
• Seasonal trends
This generates a risk score used for dynamic weekly premium pricing.

(b)Fraud Detection
  AI prevents false claims using:
• GPS location validation
• Delivery activity verification
• Duplicate claim detection

9. Application Workflow
• Rider registers on the platform.
• The system collects basic details such as location, delivery type, and working hours.
• AI analyzes the data and calculates a risk score and weekly premium.
• The rider selects and purchases a weekly insurance plan.
• The platform continuously monitors environmental data (weather, pollution, etc.) using APIs.
• If disruption thresholds are exceeded, a parametric trigger is automatically activated.
• The system estimates the income lost during the disruption period.
• An automatic payout is instantly transferred to the rider’s account.

10. Development Plan
Phase 1 – Ideation
Research persona, choose our category, define disruption triggers for system, pricing model, searching the AI strategy, and noting down the tech stack.

Phase 2 – Prototype
Develop web interface, basic layout, integrate the APIs, simulate disruption triggers in the project.

Phase 3 – AI & Automation
Implement ML risk models, fraud detection, automated payout system, and analytics dashboard inthe project.

11. Quick summary of features -
Key Features are :
• Optimized onboarding for delivery partners
• Weekly subscription insurance model
• AI-powered risk scoring and dynamic pricing
• Real-time disruption monitoring
• Automated parametric claim triggering
• Intelligent fraud detection
• Instant payout processing
• Analytics dashboard for monitoring disruptions and payouts

Architecture diagram
![WhatsApp Image 2026-03-10 at 11 50 16 PM](https://github.com/user-attachments/assets/204aee94-86cc-4691-aff1-a4e94dc85e08)








