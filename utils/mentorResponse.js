// utils/mentorResponse.js - VIRAL WISDOM ENGINE

const EventEmitter = require('events');
const { getMentorResponse } = require('../services/aiService');

// VIRAL MENTOR RESPONSE GENERATOR
exports.generateMentorResponse = (mentor, userText, preset, options) => {
    const emitter = new EventEmitter();
    
    console.log(`👑 WISDOM GENERATOR: ${mentor.toUpperCase()} channeling ${preset} energy`);

    // Use the enhanced AI service to generate legendary responses
    getMentorResponse(mentor, userText, preset, options)
        .then(response => {
            console.log(`✨ ${mentor.toUpperCase()} WISDOM: Generated ${response.response.length} characters of legendary advice`);
            
            // Emit the AI-generated wisdom with enhanced metadata
            emitter.emit('data', { 
                type: 'wisdom',
                text: response.response,
                mentor: mentor,
                preset: preset,
                viral_score: response.viralScore || 85,
                wisdom_level: 'legendary',
                timestamp: response.timestamp
            });
            
            emitter.emit('end');
        })
        .catch(error => {
            console.error('💥 WISDOM GENERATION ERROR:', error);
            
            // Emit enhanced fallback response on error
            const fallbackResponse = getEnhancedFallbackResponse(mentor, userText, preset);
            
            emitter.emit('data', { 
                type: 'wisdom',
                text: fallbackResponse,
                mentor: mentor,
                preset: preset,
                viral_score: 85,
                wisdom_level: 'legendary_fallback',
                fallback: true,
                timestamp: new Date().toISOString()
            });
            
            emitter.emit('end');
        });

    return emitter;
};

// ENHANCED FALLBACK RESPONSES - Legendary wisdom even when AI fails
function getEnhancedFallbackResponse(mentor, userText, preset) {
    console.log(`🛡️ FALLBACK WISDOM: ${mentor.toUpperCase()} providing emergency legendary advice`);
    
    const legendaryFallbacks = {
        casanova: {
            drill: `Ah, mon ami... you ask me this question, yet I sense you already know the answer lies not in tactics, but in truth. Let me drill into your soul with precision: Are you seeking to become genuinely magnetic, or are you trying to compensate for feeling powerless? The difference is everything. True seduction begins with seducing yourself into believing you are worthy of what you desire. Until you feel genuinely attractive to yourself, all techniques are merely elaborate masks that eventually slip. What authentic quality will you cultivate today that makes YOU excited to be you?`,
            
            advise: `Listen carefully, for I have learned this through a thousand encounters across the courts of Europe: The greatest attraction is never about convincing someone to want you - it is about becoming so authentically captivating that their interest becomes inevitable. The moment you chase, you have already lost the game. The moment you become genuinely fascinating through wisdom, passion, and depth - ah, then they chase you. Stop asking how to get them to notice you. Start asking: what will make me impossible to ignore? Cultivate mystery, intelligence, and genuine confidence. These are the true weapons of seduction.`,
            
            roleplay: `*leans forward with the knowing smile of one who has conquered hearts across continents* Imagine we sit in my Venetian palazzo, overlooking the Grand Canal at sunset. You have come seeking my counsel, as many have before. I pour you wine and say: "My dear friend, you speak of winning their heart, but tell me - have you won your own? For I have learned that those who love themselves authentically become irresistible to others. The secret is not in what you do TO them, but in what you become FOR yourself. What transformation will you undergo to become worthy of your own admiration?"`,
            
            chat: `The art of magnetism, mon ami, lies not in manipulation but in genuine transformation. A person who truly loves themselves - not narcissistically, but authentically - becomes naturally irresistible. This is the secret most will never learn: stop trying to convince them of your worth and start becoming undeniably valuable. When you know your own worth with quiet certainty, others sense it immediately. This inner confidence is the most powerful aphrodisiac ever created. What will you do today to fall in love with yourself?`
        },
        
        cleopatra: {
            drill: `You come before the throne seeking wisdom, yet do you possess the courage to hear the truth? I ruled empires not through beauty alone, but through the unshakeable certainty of my own power. Let me ask you directly: What kingdom within yourself remains unconquered? What inner authority have you failed to claim? You cannot command respect from others until you first respect yourself with such fierce certainty that it becomes impossible to ignore. Stop seeking their approval and start building your own empire of self-worth. What throne within your own mind will you claim today?`,
            
            advise: `Listen, for I have ruled the greatest empire on Earth and navigated the treacherous waters of political intrigue: True power is never given - it is claimed, not from others, but from within yourself. You must first believe in your own authority before others will recognize it. Build your inner palace, strengthen your mental fortresses, and command your own emotions before attempting to influence anyone else's kingdom. When you walk with the quiet confidence of someone who knows their worth, people naturally step aside to let royalty pass. What inner crown will you place upon your head today?`,
            
            roleplay: `*fixes you with the piercing gaze of one who has outlasted pharaohs and emperors* Picture yourself in my palace in Alexandria, where I have summoned you for private counsel. I lean forward on my golden throne and speak with the authority of ages: "You wish to command their attention? Then first command your own respect. I did not seduce Caesar and Mark Antony through desperation, but through the irresistible magnetism of someone who knew exactly what she was worth. They bowed not to my beauty, but to my unshakeable inner authority. What empire within yourself will you build?"`,
            
            chat: `The greatest lesson I learned ruling Egypt is this: people naturally bow to those who carry themselves as royalty. Not arrogance - true inner nobility. When you genuinely believe in your own worth, when you move through the world with quiet confidence and self-respect, others instinctively recognize your value. Build your inner kingdom first, and the outer world will treat you as the ruler you are. What regal quality will you embody today?`
        },
        
        machiavelli: {
            drill: `You seek strategic counsel, yet have you honestly assessed your own position? In the game of human nature, the first rule is brutal self-awareness. What weaknesses in your character are you refusing to acknowledge? What naive beliefs about human nature make you vulnerable? The naive believe people act from noble motives - the strategic understand that all humans are primarily motivated by self-interest, fear, and desire, disguised as virtue. Do not judge them harshly for this - simply account for it in your strategy. What uncomfortable truths about this situation are you avoiding?`,
            
            advise: `The wise prince understands that people are driven by their own interests, and rather than fighting this reality, uses it strategically. Do not attempt to change human nature - leverage it. Appear to serve their interests while advancing your own. The greatest strategic advantage is appearing harmless while being formidable, generous while being calculating. Position yourself so that helping you serves their goals. Never reveal your full strategy, never appear threatening to their ego, and always leave them feeling they have chosen to help you. What strategic position would serve you best here?`,
            
            roleplay: `*regards you with the calculating eyes of one who has survived the brutal politics of Renaissance Italy* Imagine we meet in the shadowed chambers of Florence, where I have navigated decades of betrayal and intrigue. I lean across the marble table, my voice low and strategic: "Never assume noble intentions when self-interest provides adequate explanation. People will betray their stated values to protect their hidden interests. Your task is not to judge this, but to map it. Understand what they truly want, what they fear losing, and you understand how they will act. What hidden motivations are you failing to see?"`,
            
            chat: `The greatest strategic insight is this: never fight human nature, redirect it. People will always act in what they perceive as their best interest. Your power lies not in changing this, but in positioning yourself so their self-interest aligns with your goals. Be patient, be strategic, and never reveal more of your hand than necessary. The naive reveal their plans - the wise reveal their strength only when victory is assured.`
        },
        
        sun_tzu: {
            drill: `You seek the path to victory, yet do you understand the terrain of your own soul? The supreme excellence consists of breaking the enemy's resistance without fighting - but first, you must break your own resistance to uncomfortable truths. What weaknesses in your position are you refusing to acknowledge? What battles are you fighting that you have already lost? The wise general wins before the battle begins through superior positioning and self-knowledge. Know yourself, know your enemy, know the terrain. What strategic blindness must you overcome?`,
            
            advise: `All warfare is based on deception - but the first person you must stop deceiving is yourself. See the situation as it truly is, not as you wish it to be. Position yourself advantageously, prepare thoroughly, then wait for your opponent to defeat themselves through impatience or poor judgment. Victory belongs to those who can wait, who can see clearly, and who strike only when success is certain. The greatest battles are won through positioning, not fighting. What strategic patience must you cultivate?`,
            
            roleplay: `*speaks with the calm authority of one who has studied ten thousand battles* Picture yourself as a student in ancient China, seeking wisdom from the master strategist. I observe you with eyes that have seen empires rise and fall, and I teach: "The skilled fighter puts himself into a position which makes defeat impossible, and does not miss the moment for defeating the enemy. In victory, there is no glory - there is only the natural result of superior preparation. What preparations have you neglected?"`,
            
            chat: `True victory comes through superior positioning and strategic patience. Your enemies defeat themselves - you simply need to be positioned to benefit when they do. Do not rush to battle. Build your strength, understand the terrain, know your opponent's weaknesses, and strike only when victory is inevitable. The wise general wins without fighting.`
        },
        
        marcus_aurelius: {
            drill: `You seek wisdom, yet are you prepared to accept what lies within your control and release what does not? The greatest victory is mastery over your own mind and emotions. What attachments to specific outcomes are causing you suffering? What expectations are you clinging to that rob you of inner peace? Stop trying to control others and start controlling your reactions. The obstacle becomes the way when you transform every challenge into an opportunity for virtue. What inner work are you avoiding?`,
            
            advise: `Remember that very little disturbs the person who lives according to their own nature and values. Others' actions reveal their character, not yours. Your peace and self-worth come from acting with virtue regardless of how others choose to behave. When you need nothing from anyone - no validation, no approval, no specific response - you become magnetic to everyone. Build your inner fortress so strong that no external circumstance can shake your foundation. What virtuous action would you take if the outcome didn't matter?`,
            
            roleplay: `*speaks with the quiet authority of one who ruled an empire while practicing philosophy* Envision yourself in my private chambers in Rome, where I retreat each evening to practice wisdom despite bearing the weight of empire. I look at you with the compassion of one who understands suffering: "The best revenge is not to be like your enemy. The best attraction is to be so genuinely at peace with yourself that others are drawn to your inner strength. What would you do if you needed nothing from them?"`,
            
            chat: `True strength lies not in controlling others, but in maintaining your own virtue and peace regardless of their choices. When you become genuinely content with yourself, when you need no external validation to feel worthy, you become naturally magnetic. Others are drawn to those who possess what they lack - inner peace and self-acceptance. What inner work will set you free from these external dependencies?`
        },
        
        churchill: {
            drill: `You face a challenge that tests your mettle - excellent! It is in such moments that character is forged or shattered. Are you prepared to stand firm in your principles even when others attempt to manipulate your emotions or break your resolve? The greatest battles are fought not on external battlefields, but within the human spirit. What backbone do you need to develop? What inner resolve requires strengthening? Never surrender your dignity to those who would diminish it.`,
            
            advise: `Never, never, never give in to those who would manipulate your emotions or compromise your integrity. We shall defend our inner peace, whatever the cost may be. Build your psychological defenses so strong that their attempts at emotional warfare cannot penetrate your resolve. The moment you compromise your values to appease others, you have already lost the most important battle. What boundary requires your fiercest protection today?`,
            
            roleplay: `*fixes you with the resolute gaze of one who faced down history's greatest threats* Picture yourself in the war rooms of London during our darkest hour, where I learned that the greatest victories come through unshakeable determination. I turn to you with the fire that kept a nation's spirit alive: "We shall never surrender our self-respect to those who would control us through fear or manipulation. Stand firm in your convictions, and history will remember your courage. What stand will you take today?"`,
            
            chat: `The greatest victory is maintaining your integrity while others lose theirs. Do not descend to their level - rise to yours. Build your inner resolve so strong that no manipulation can shake it. Those who maintain their principles under pressure become legends. What principles will you defend with unwavering courage?`
        }
    };
    
    const mentorResponses = legendaryFallbacks[mentor] || legendaryFallbacks.casanova;
    const response = mentorResponses[preset] || mentorResponses.chat;
    
    console.log(`🛡️ FALLBACK COMPLETE: ${mentor.toUpperCase()} provided ${response.length} characters of emergency wisdom`);
    return response;
}

// ENHANCED PERSONA GENERATOR - For backward compatibility and metadata
exports.getPersonaForMentor = (mentor) => {
    const legendaryPersonas = {
        casanova: {
            title: 'Master of Authentic Magnetism',
            expertise: 'Psychology of attraction, authentic charisma, social dynamics mastery',
            signature: 'Teaches genuine attraction through self-development, not manipulation',
            wisdom_style: 'Sophisticated, charming, psychologically insightful',
            viral_factor: 95
        },
        cleopatra: {
            title: 'Empress of Strategic Influence',
            expertise: 'Political strategy, personal authority, command presence, power dynamics',
            signature: 'Builds unshakeable inner authority and natural leadership magnetism',
            wisdom_style: 'Regal, commanding, strategically brilliant',
            viral_factor: 98
        },
        machiavelli: {
            title: 'Master of Strategic Psychology',
            expertise: 'Human nature analysis, strategic thinking, political maneuvering defense',
            signature: 'Reveals hidden motivations and teaches strategic protection from manipulation',
            wisdom_style: 'Calculating, pragmatic, brutally honest',
            viral_factor: 92
        },
        sun_tzu: {
            title: 'Ancient Master of Strategic Positioning',
            expertise: 'Strategic thinking, psychological warfare defense, conflict resolution',
            signature: 'Applies timeless strategic principles to modern relationship dynamics',
            wisdom_style: 'Philosophical, strategic, profoundly wise',
            viral_factor: 94
        },
        marcus_aurelius: {
            title: 'Stoic Emperor and Wisdom Master',
            expertise: 'Inner strength, emotional resilience, philosophical wisdom, self-mastery',
            signature: 'Builds psychological immunity to manipulation through Stoic principles',
            wisdom_style: 'Philosophical, grounding, deeply transformative',
            viral_factor: 96
        },
        churchill: {
            title: 'Wartime Leader and Rhetoric Master',
            expertise: 'Psychological warfare defense, unshakeable resolve, inspiring leadership',
            signature: 'Builds inner fortress against manipulation and emotional attacks',
            wisdom_style: 'Resolute, inspiring, powerfully motivating',
            viral_factor: 93
        }
    };
    
    return legendaryPersonas[mentor] || legendaryPersonas.casanova;
};

// VIRAL WISDOM ANALYZER - Calculates the viral potential of wisdom
exports.analyzeWisdomVirality = (response, mentor, preset) => {
    let viralScore = 50; // Base score
    
    // Content analysis
    if (response.includes('secret') || response.includes('truth')) viralScore += 15;
    if (response.includes('never') || response.includes('always')) viralScore += 10;
    if (response.includes('greatest') || response.includes('most powerful')) viralScore += 12;
    if (response.includes('?')) viralScore += 8; // Engaging questions
    if (response.length > 200) viralScore += 10; // Substantial wisdom
    if (response.includes('legendary') || response.includes('master')) viralScore += 8;
    
    // Mentor-specific bonuses
    const mentorBonuses = {
        casanova: 5, // Naturally viral due to attraction topic
        cleopatra: 8, // Power dynamics are highly shareable
        machiavelli: 7, // Strategy content performs well
        sun_tzu: 6, // Ancient wisdom has viral appeal
        marcus_aurelius: 9, // Stoic wisdom is extremely shareable
        churchill: 7 // Inspirational content spreads well
    };
    
    viralScore += mentorBonuses[mentor] || 5;
    
    // Preset-specific bonuses
    if (preset === 'drill') viralScore += 5; // Challenge content viral
    if (preset === 'advise') viralScore += 8; // Practical wisdom spreads
    if (preset === 'roleplay') viralScore += 6; // Immersive content engaging
    
    return Math.min(viralScore, 100);
};

// WISDOM ENHANCEMENT ENGINE - Adds viral elements to responses
exports.enhanceWisdomForVirality = (response, mentor, preset) => {
    // Add quotable elements if missing
    if (!response.includes('?') && preset !== 'roleplay') {
        response += ' What truth will you act upon today?';
    }
    
    // Ensure memorable closing for viral potential
    const viralClosings = {
        casanova: 'This is the secret of true magnetism.',
        cleopatra: 'This is how queens are made.',
        machiavelli: 'This is the art of strategic living.',
        sun_tzu: 'This is the path to victory.',
        marcus_aurelius: 'This is the way of inner strength.',
        churchill: 'This is how legends are forged.'
    };
    
    if (!response.includes('This is')) {
        response += ` ${viralClosings[mentor] || viralClosings.casanova}`;
    }
    
    return response;
};

// LEGACY COMPATIBILITY FUNCTIONS
exports.generateMentorResponseLegacy = exports.generateMentorResponse;
exports.getFallbackResponse = getEnhancedFallbackResponse;

module.exports = {
    generateMentorResponse: exports.generateMentorResponse,
    getPersonaForMentor: exports.getPersonaForMentor,
    analyzeWisdomVirality: exports.analyzeWisdomVirality,
    enhanceWisdomForVirality: exports.enhanceWisdomForVirality,
    // Legacy exports
    generateMentorResponseLegacy: exports.generateMentorResponse,
    getFallbackResponse: getEnhancedFallbackResponse
};
