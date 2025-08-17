const EventEmitter = require('events');

exports.generateMentorResponse = (mentor, userText, preset, options) => {
    const emitter = new EventEmitter();

    // Simulate mentor response generation
    setTimeout(() => {
        const response = `Response from mentor ${mentor} to user text: ${userText}`;
        emitter.emit('data', { text: response });
        emitter.emit('end');
    }, 1000); // Simulating a delay for streaming

    return emitter;
};
