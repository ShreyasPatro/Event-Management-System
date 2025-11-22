const express = require('express');
// Removed fetch dependency as we are using a mock response

/**
 * The core logic for the AI analysis endpoint using a MOCK response.
 * This is a temporary measure to bypass the API Key failure and allow frontend development.
 */
const analyzeProposal = async (req, res) => {
    // We still capture the input to provide contextual feedback
    const { description, category, budget, footfall } = req.body;

    // Error Handling: Missing Input (Check 1)
    if (!description || !category || !budget || !footfall) {
        return res.status(400).json({ error: "Missing required event details for analysis." });
    }
    
    console.warn("--- WARNING: AI Analysis is using a MOCK response due to API Key failure. Development should continue. ---");

    // Mock analysis data structure based on the required schema
    const mockResult = {
        summary: `The proposal for a ${category} event is structurally sound, with a budget of ₹${budget} and an estimated attendance of ${footfall}. The high predicted feasibility indicates strong potential, though execution details require verification.`,
        suggestions: [
            `Develop a detailed risk assessment matrix covering ${category} specific challenges.`,
            `Identify specific local partnerships to help solidify the ₹${budget} estimate.`,
            `Implement a detailed marketing plan to guarantee the ${footfall} attendance target.`
        ],
        strengths: [
            "Clear alignment with university's goals.",
            "Efficient use of budget relative to expected attendance."
        ],
        concerns: [
            "Reliance on external third-party services, requiring contract negotiation.",
            "Contingency plan for budget overruns is not clearly defined."
        ]
    };

    // 3. Return the structured data
    return res.json({
        summary: mockResult.summary,
        suggestions: mockResult.suggestions,
        strengths: mockResult.strengths,
        concerns: mockResult.concerns
    });
};

// Export the function instead of the router
module.exports = { analyzeProposal };