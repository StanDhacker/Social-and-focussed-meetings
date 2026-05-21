/**
 * Meeting Recommendations Configuration
 * 
 * You can edit this file to customize the advice and rationales shown to teammates
 * based on their personality nature (Introvert, Ambivert, Extravert) and the
 * average meeting state (calculated from focus and social scores).
 * 
 * The 4 meeting states correspond to the grid quadrants:
 * 1. high_focus_high_social: Focus >= 50%, Social >= 50% (Synergistic & Balanced)
 * 2. low_focus_high_social: Focus < 50%, Social >= 50% (Too Social / Off-topic)
 * 3. high_focus_low_social: Focus >= 50%, Social < 50% (Too Transactional / Cold)
 * 4. low_focus_low_social: Focus < 50%, Social < 50% (Unfocused & Draining)
 */

window.MEETING_RECOMMENDATIONS = {
  // Quadrant 1: High Focus, High Social (Synergy: Focused & Socially Engaged)
  high_focus_high_social: {
    title: "Synergistic & Balanced",
    description: "The meeting is highly focused on objectives while remaining socially warm and collaborative.",
    introvert: {
      action: "Share reflections in writing afterward",
      rationale: "Ensures your deep analytical thoughts, which you might not have spoken aloud during high-energy exchanges, are captured by the team."
    },
    extravert: {
      action: "Create space for quieter team members",
      rationale: "Since the social vibe is positive, invite introverts to share their perspectives to unlock even deeper, diverse insights."
    },
    ambivert: {
      action: "Bridge communication styles",
      rationale: "Act as a translator between high-energy speakers and quieter observers to sustain this balanced momentum."
    }
  },

  // Quadrant 2: Low Focus, High Social (Too Social: Chatty, Unfocused)
  low_focus_high_social: {
    title: "Socially Healthy but Unfocused",
    description: "The team is enjoying high social connection, but off-topic talk has drifted away from the meeting's core objectives.",
    introvert: {
      action: "Introduce a visual structure or timer",
      rationale: "Suggesting a quick screen share or a timed agenda item helps steer the group back to task without you needing to interrupt verbally."
    },
    extravert: {
      action: "Redirect storytelling back to the agenda",
      rationale: "Using your strong social influence to wrap up off-topic banter and ask, 'Where were we on the next goal?' keeps energy high but focused."
    },
    ambivert: {
      action: "Call for a quick alignment check",
      rationale: "Leverage your adaptability to say, 'We have great energy today, let's channel it into wrapping up this decision in the next 10 minutes.'"
    }
  },

  // Quadrant 3: High Focus, Low Social (Too Transactional: Cold, Goal-only)
  high_focus_low_social: {
    title: "Highly Focused but Socially Cold",
    description: "Objectives are being met efficiently, but the atmosphere feels dry, transactional, or draining for participants.",
    introvert: {
      action: "Share a brief personal check-in or simple appreciation",
      rationale: "A small, low-pressure contribution like 'Great work on that slide' adds human warmth without requiring exhausting small talk."
    },
    extravert: {
      action: "Initiate micro-connections or ask open-ended questions",
      rationale: "Ask for brief thoughts on how people feel about the decisions, breaking the coldness and helping others feel heard and valued."
    },
    ambivert: {
      action: "Lighten the mood with a brief joke or warm transitions",
      rationale: "Use your middle-ground energy to introduce casual check-ins between agenda items, easing tension without derailing the focus."
    }
  },

  // Quadrant 4: Low Focus, Low Social (Friction: Unfocused & Socially Cold)
  low_focus_low_social: {
    title: "Unfocused & Socially Draining",
    description: "The meeting lacks clear direction, and participants feel disconnected, quiet, or fatigued.",
    introvert: {
      action: "Propose a 2-minute silent writing exercise",
      rationale: "Gives everyone time to collect thoughts quietly, removing the pressure of filling awkward silence and refocusing on the core problem."
    },
    extravert: {
      action: "Enthusiastically ask for clarification on the goal",
      rationale: "Asking 'Let's take a step back, what is the main decision we want to make right now?' injects needed energy and re-centers the team."
    },
    ambivert: {
      action: "Suggest a quick summary of progress so far",
      rationale: "Synthesizing the current state provides a low-stress checkpoint that clarifies the next steps and helps lift the collective fatigue."
    }
  }
};
