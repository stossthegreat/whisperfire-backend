// routes/progress.js
// Handles progress event (XP, streaks, etc.)

const firebaseAdmin = require('firebase-admin');

// Progress event route
exports.progressEvent = async (req, res) => {
    try {
        const { type, meta, idempotencyKey } = req.body;

        // Check idempotency
        if (await checkIdempotency(idempotencyKey)) {
            return res.status(400).json({ error: 'Duplicate event.' });
        }

        // Process the event
        const userProgress = await updateUserProgress(type, meta);

        res.status(200).json(userProgress);
    } catch (error) {
        res.status(500).json({ error: 'Error processing progress event.' });
    }
};

// Helper function to update user progress
async function updateUserProgress(type, meta) {
    const userRef = firebaseAdmin.firestore().collection('users').doc(meta.userId);

    let updateData = {};

    // Example of XP and level logic
    if (type === 'lesson_completed') {
        updateData = {
            xp: meta.successScore * 10, // Update XP logic
            level: Math.floor(meta.successScore / 10), // Update level
        };
    }

    await userRef.update(updateData);
    return updateData;
}

// Check for idempotency
async function checkIdempotency(idempotencyKey) {
    const ref = firebaseAdmin.firestore().collection('idempotency').doc(idempotencyKey);
    const doc = await ref.get();
    return doc.exists;
} 