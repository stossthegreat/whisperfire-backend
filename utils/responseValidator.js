// utils/responseValidator.js
// Validates and formats the response for both scan and pattern

exports.WhisperfireResponse = {
    generateScanResult: (message, tone, relationship) => {
        return {
            message,
            tone,
            relationship,
            result: 'scan result data',
        };
    },

    generatePatternResult: (messages, tone, relationship) => {
        return {
            messages,
            tone,
            relationship,
            result: 'pattern result data',
        };
    }
};

exports.validateResponse = (response) => {
    // Perform validation on the response
    if (response && response.result) {
        return response;
    } else {
        throw new Error('Invalid response format.');
    }
}; 