// services/firebaseService.js

const firebaseAdmin = require('firebase-admin');

// Initialize Firebase if not already initialized
if (!firebaseAdmin.apps.length) {
  firebaseAdmin.initializeApp();
}

// Save user progress to Firestore
async function saveProgress(userId, progressData) {
  try {
    const userRef = firebaseAdmin.firestore().collection('users').doc(userId);
    await userRef.set(progressData, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error saving progress:', error);
    throw error;
  }
}

// Get user progress from Firestore
async function getProgress(userId) {
  try {
    const userRef = firebaseAdmin.firestore().collection('users').doc(userId);
    const doc = await userRef.get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('Error getting progress:', error);
    throw error;
  }
}

module.exports = {
  saveProgress,
  getProgress
}; 