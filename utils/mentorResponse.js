// utils/mentorResponse.js
// Generates mentor persona responses

exports.generateMentorResponse = (mentor, userText, preset, options) => {
    const persona = getPersonaForMentor(mentor);

    // Build the response based on the preset
    let responseText = '';
    switch (preset) {
        case 'drill':
            responseText = `${persona}: Drill response based on ${userText}`;
            break;
        case 'advise':
            responseText = `${persona}: Advice on ${userText}`;
            break;
        case 'roleplay':
            responseText = `${persona}: Roleplay response for ${userText}`;
            break;
        default:
            responseText = `${persona}: General chat response for ${userText}`;
            break;
    }

    return { responseText };
};

function getPersonaForMentor(mentor) {
    // Return the persona message based on the mentor
    const personas = {
        sun_tzu: 'Strategic and calm',
        machiavelli: 'Cunning and practical',
        cleopatra: 'Charismatic and persuasive',
        // Add more mentors as needed
    };

    return personas[mentor] || 'General mentor persona';
} 