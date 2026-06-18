/**
 * Supabase-enabled Fullscreen Meeting Reflection Logic
 * Coordinates ratings across multiple users in real-time.
 */

// --------------------------------------------------------------------------
// Supabase Configuration
// Paste your Supabase Project credentials below.
// --------------------------------------------------------------------------
const SUPABASE_URL = "https://xksfjsejecbrupctlntc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrc2Zqc2VqZWNicnVwY3RsbnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMjgyMDcsImV4cCI6MjA5NjkwNDIwN30.2F2HvYDoogXd2Fllnuezus2wAqKwu6Ea-sTWWiFZ9xc";

document.addEventListener('DOMContentLoaded', () => {
  // Team Color Palette for Color-Coding
  const TEAM_COLORS = [
    '#f87171', // Coral/Red
    '#34d399', // Emerald/Green
    '#60a5fa', // Sky Blue
    '#fbbf24', // Amber/Yellow
    '#c084fc', // Violet/Lavender
    '#2dd4bf'  // Teal
  ];

  // Map focus and social scores to visual, feeling-based descriptions
  function getVibeLabel(focus, social) {
    if (focus === null || social === null) return "Select your vibe";
    const isFocused = focus >= 50;
    const isSocial = social >= 50;
    if (isFocused && isSocial) {
      return "Focused & Socially Engaging";
    } else if (!isFocused && isSocial) {
      return "Off-topic & Socially Engaging";
    } else if (isFocused && !isSocial) {
      return "Focused & Socially Cold";
    } else {
      return "Off-topic & Socially Cold";
    }
  }

  // State variables
  let supabaseClient = null;
  let sessionId = null;
  let selectedX = null;
  let selectedY = null;
  let isLocked = false;
  let isSubmitted = false;
  let isOverviewRevealed = false;
  let currentRatings = [];

  // DOM Elements
  const ratingGrid = document.getElementById('ratingGrid');
  const gridTooltip = document.getElementById('gridTooltip');
  const userMarker = document.getElementById('userMarker');
  const averageMarker = document.getElementById('averageMarker');
  const teamMarkersContainer = document.getElementById('teamMarkersContainer');
  const btnAction = document.getElementById('btnAction');
  const btnShare = document.getElementById('btnShare');
  const summaryResults = document.getElementById('summaryResults');
  const controlDock = document.getElementById('controlDock');
  const setupOverlay = document.getElementById('setupOverlay');
  const btnCreateSession = document.getElementById('btnCreateSession');
  const toastAlert = document.getElementById('toastAlert');

  // Overview DOM Elements
  const overviewOverlay = document.getElementById('overviewOverlay');
  const overviewAverage = document.getElementById('overviewAverage');
  const scoresList = document.getElementById('scoresList');
  const btnBackToGrid = document.getElementById('btnBackToGrid');
  const btnRefreshOverview = document.getElementById('btnRefreshOverview');

  // Recommendations DOM Elements
  const recommendationsOverlay = document.getElementById('recommendationsOverlay');
  const btnGoToRecommendations = document.getElementById('btnGoToRecommendations');
  const btnBackToOverview = document.getElementById('btnBackToOverview');

  // Prevent dock clicks from placing markers on grid
  controlDock.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Initialize Supabase Client
  function initSupabase() {
    if (SUPABASE_URL.startsWith("YOUR_") || SUPABASE_ANON_KEY.startsWith("YOUR_")) {
      console.warn("Supabase credentials not configured. Running in fallback demo mode.");
      return null;
    }
    try {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.error("Failed to initialize Supabase client:", e);
      return null;
    }
  }

  supabaseClient = initSupabase();

  // Parse session ID from URL
  function checkSession() {
    const urlParams = new URLSearchParams(window.location.search);
    sessionId = urlParams.get('session');

    if (sessionId) {
      // Load active session
      setupOverlay.style.display = 'none';
      controlDock.style.display = 'flex';
      loadSessionState();
    } else {
      // Show create session overlay
      setupOverlay.style.display = 'flex';
      controlDock.style.display = 'none';
    }
  }

  // Session ID generator
  btnCreateSession.addEventListener('click', () => {
    const randomId = Math.random().toString(36).substring(2, 11) + '-' + Math.random().toString(36).substring(2, 6);
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?session=' + randomId;
    window.history.pushState({ path: newUrl }, '', newUrl);
    checkSession();
  });

  // URL Copy Share Action
  btnShare.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toastAlert.classList.add('show');
      setTimeout(() => {
        toastAlert.classList.remove('show');
      }, 2000);
    }).catch(err => {
      console.error('Could not copy link: ', err);
    });
  });

  // Load state based on local storage submissions
  function loadSessionState() {
    const localSubmitted = localStorage.getItem(`submitted_${sessionId}`);
    isOverviewRevealed = localStorage.getItem(`overview_revealed_${sessionId}`) === 'true';

    if (localSubmitted === 'true') {
      isSubmitted = true;
      isLocked = true;
      
      // Retrieve user's previous selection from local storage
      selectedX = parseInt(localStorage.getItem(`user_x_${sessionId}`));
      selectedY = parseInt(localStorage.getItem(`user_y_${sessionId}`));

      // Position user marker
      userMarker.style.left = `${selectedX}%`;
      userMarker.style.top = `${100 - selectedY}%`;
      userMarker.classList.add('active');

      gridTooltip.style.opacity = '0';
      btnAction.textContent = 'Show Overview';
      btnAction.removeAttribute('disabled');

      // Fetch and overlay collective ratings
      syncSessionRatings();
    } else {
      // Clean slate for new feedback
      isSubmitted = false;
      isLocked = false;
      isOverviewRevealed = false;
      selectedX = null;
      selectedY = null;
      userMarker.classList.remove('active');
      averageMarker.classList.remove('active');
      teamMarkersContainer.innerHTML = '';
      btnAction.textContent = 'Submit Rating';
      btnAction.setAttribute('disabled', 'true');
      summaryResults.textContent = 'Click anywhere on the screen to rate the session';
      gridTooltip.style.opacity = '0';
    }
  }

  // Fetch coordinates from Supabase and render consolidated scatter plot
  async function syncSessionRatings() {
    if (!supabaseClient) {
      // Fallback demo ratings if Supabase is unconfigured
      renderMockRatings();
      return;
    }

    try {
      summaryResults.textContent = 'Fetching team reviews...';

      const { data, error } = await supabaseClient
        .from('meeting_feedback')
        .select('focus_score, social_score')
        .eq('session_id', sessionId);

      if (error) throw error;

      renderRatings(data || []);
    } catch (err) {
      console.error('Error syncing ratings:', err);
      summaryResults.textContent = 'Sync failed: ' + (err.message || err);
    }
  }

  // Render database submissions on grid
  function renderRatings(ratingsList) {
    teamMarkersContainer.innerHTML = '';
    currentRatings = ratingsList;

    if (ratingsList.length === 0) {
      summaryResults.textContent = 'You are the first to rate. Share the link!';
      averageMarker.classList.remove('active');
      return;
    }

    // Plot all submissions as translucent team markers
    ratingsList.forEach((pt, index) => {
      // Skip plotting a marker directly on top of the user's coordinate to keep view clean
      if (pt.focus_score === selectedX && pt.social_score === selectedY) {
        return;
      }

      const color = TEAM_COLORS[index % TEAM_COLORS.length];
      const marker = document.createElement('div');
      marker.className = 'team-marker';
      marker.style.left = `${pt.focus_score}%`;
      marker.style.top = `${100 - pt.social_score}%`;
      marker.style.backgroundColor = color;
      marker.style.boxShadow = `0 0 10px ${color}a0`;
      teamMarkersContainer.appendChild(marker);

      setTimeout(() => {
        marker.classList.add('active');
      }, 50 + index * 80);
    });

    // Always hide average marker on grid (moved to text overview modal)
    averageMarker.classList.remove('active');

    // Only show user details in the dock
    summaryResults.innerHTML = `
      <div class="summary-row">
        <span><span class="summary-data-label">Your Vibe:</span><span class="summary-data-value">${getVibeLabel(selectedX, selectedY)}</span></span>
      </div>
    `;

    // If the overview list is currently visible, refresh its text content dynamically
    if (overviewOverlay.style.display === 'flex') {
      populateOverview();
    }
  }

  // Populate Text-based Overview Overlay Panel
  function populateOverview() {
    if (currentRatings.length === 0) return;

    // Calculate statistical averages
    const allX = currentRatings.map(r => r.focus_score);
    const allY = currentRatings.map(r => r.social_score);

    const avgX = Math.round(allX.reduce((a, b) => a + b, 0) / allX.length);
    const avgY = Math.round(allY.reduce((a, b) => a + b, 0) / allY.length);

    // Update Average banner
    overviewAverage.textContent = getVibeLabel(avgX, avgY);

    // Render list items
    scoresList.innerHTML = '';
    
    currentRatings.forEach((pt, index) => {
      const isUser = (pt.focus_score === selectedX && pt.social_score === selectedY);
      const color = TEAM_COLORS[index % TEAM_COLORS.length];
      
      const item = document.createElement('div');
      item.className = isUser ? 'score-item user-item' : 'score-item';
      
      item.innerHTML = `
        <span class="score-person">
          <span class="score-color-dot" style="color: ${color}; background-color: ${color};"></span>
          Person ${index + 1}${isUser ? ' (You)' : ''}
        </span>
        <span class="score-values">${getVibeLabel(pt.focus_score, pt.social_score)}</span>
      `;
      scoresList.appendChild(item);
    });
  }

  // Fallback demo ratings generator
  function renderMockRatings() {
    const mockList = [
      { focus_score: Math.max(5, Math.min(95, selectedX + 15)), social_score: Math.max(5, Math.min(95, selectedY - 10)) },
      { focus_score: Math.max(5, Math.min(95, selectedX - 8)), social_score: Math.max(5, Math.min(95, selectedY + 12)) },
      { focus_score: Math.max(5, Math.min(95, selectedX + 12)), social_score: Math.max(5, Math.min(95, selectedY - 15)) },
      { focus_score: Math.max(5, Math.min(95, selectedX - 15)), social_score: Math.max(5, Math.min(95, selectedY + 8)) },
      { focus_score: Math.max(5, Math.min(95, selectedX + 5)), social_score: Math.max(5, Math.min(95, selectedY + 5)) }
    ];
    renderRatings([...mockList, { focus_score: selectedX, social_score: selectedY }]);
    
    if (isOverviewRevealed) {
      summaryResults.innerHTML += `
        <div class="summary-row" style="margin-top: 0.15rem; color: #f59e0b; font-size: 0.7rem;">
          <span>Running in demo mode (credentials unconfigured)</span>
        </div>
      `;
    }
  }

  // Calculate coordinates from mouse interactions
  function getCoordinates(e) {
    const rect = ratingGrid.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clampedX = Math.max(0, Math.min(x, rect.width));
    const clampedY = Math.max(0, Math.min(y, rect.height));

    const focusPct = Math.round((clampedX / rect.width) * 100);
    const socialPct = Math.round(((rect.height - clampedY) / rect.height) * 100);

    return {
      focus: focusPct,
      social: socialPct,
      xPercent: (clampedX / rect.width) * 100,
      yPercent: (clampedY / rect.height) * 100
    };
  }

  // Hover events
  ratingGrid.addEventListener('mousemove', (e) => {
    if (isSubmitted) return;

    const coords = getCoordinates(e);

    gridTooltip.style.opacity = '1';
    gridTooltip.style.left = `${coords.xPercent}%`;
    gridTooltip.style.top = `${coords.yPercent}%`;
    
    if (coords.yPercent < 15) {
      gridTooltip.classList.add('tooltip-bottom');
    } else {
      gridTooltip.classList.remove('tooltip-bottom');
    }
    
    if (!isLocked) {
      gridTooltip.textContent = getVibeLabel(coords.focus, coords.social);
    }
  });

  // Mouse leave
  ratingGrid.addEventListener('mouseleave', () => {
    if (isSubmitted) return;
    
    if (!isLocked) {
      gridTooltip.style.opacity = '0';
    } else {
      gridTooltip.style.left = userMarker.style.left;
      gridTooltip.style.top = userMarker.style.top;
      gridTooltip.textContent = getVibeLabel(selectedX, selectedY);
      
      const yPct = parseFloat(userMarker.style.top);
      if (yPct < 15) {
        gridTooltip.classList.add('tooltip-bottom');
      } else {
        gridTooltip.classList.remove('tooltip-bottom');
      }
    }
  });

  // Coordinate Selection Click
  ratingGrid.addEventListener('click', (e) => {
    if (isSubmitted) return;

    const coords = getCoordinates(e);
    selectedX = coords.focus;
    selectedY = coords.social;
    isLocked = true;

    // Reposition user rating marker
    userMarker.style.left = `${coords.xPercent}%`;
    userMarker.style.top = `${coords.yPercent}%`;
    userMarker.classList.add('active');

    // Freeze tooltip location
    gridTooltip.style.left = `${coords.xPercent}%`;
    gridTooltip.style.top = `${coords.yPercent}%`;
    gridTooltip.textContent = getVibeLabel(selectedX, selectedY);
    gridTooltip.style.opacity = '1';

    if (coords.yPercent < 15) {
      gridTooltip.classList.add('tooltip-bottom');
    } else {
      gridTooltip.classList.remove('tooltip-bottom');
    }

    // Display selected coordinates in control dock
    summaryResults.innerHTML = `
      <div class="summary-row">
        <span><span class="summary-data-label">Selected Vibe:</span><span class="summary-data-value">${getVibeLabel(selectedX, selectedY)}</span></span>
      </div>
    `;

    btnAction.removeAttribute('disabled');
  });

  // Action Button Submission
  btnAction.addEventListener('click', async () => {
    if (isSubmitted) {
      // OPEN OVERVIEW MODAL
      isOverviewRevealed = true;
      localStorage.setItem(`overview_revealed_${sessionId}`, 'true');
      overviewOverlay.style.display = 'flex';
      populateOverview();
      return;
    }

    // SUBMIT RATING
    isSubmitted = true;
    gridTooltip.style.opacity = '0';
    btnAction.textContent = 'Show Overview';
    btnAction.setAttribute('disabled', 'true'); // Temporarily lock while writing

    // Write coordinate point to Supabase
    if (supabaseClient) {
      try {
        summaryResults.textContent = 'Saving reflection...';
        
        const { error } = await supabaseClient
          .from('meeting_feedback')
          .insert([
            { session_id: sessionId, focus_score: selectedX, social_score: selectedY }
          ]);

        if (error) throw error;

        // Set local storage submission flags
        localStorage.setItem(`submitted_${sessionId}`, 'true');
        localStorage.setItem(`user_x_${sessionId}`, selectedX.toString());
        localStorage.setItem(`user_y_${sessionId}`, selectedY.toString());

        btnAction.removeAttribute('disabled');
        syncSessionRatings();
      } catch (err) {
        console.error('Submission failed:', err);
        summaryResults.textContent = 'Failed to submit: ' + (err.message || err);
        isSubmitted = false;
        btnAction.textContent = 'Submit Rating';
        btnAction.removeAttribute('disabled');
      }
    } else {
      // Fallback demo submission
      localStorage.setItem(`submitted_${sessionId}`, 'true');
      localStorage.setItem(`user_x_${sessionId}`, selectedX.toString());
      localStorage.setItem(`user_y_${sessionId}`, selectedY.toString());
      
      btnAction.removeAttribute('disabled');
      loadSessionState();
    }
  });

  // Populate Recommendations Screen Overlay
  function populateRecommendations() {
    if (currentRatings.length === 0) return;

    // Calculate statistical averages
    const allX = currentRatings.map(r => r.focus_score);
    const allY = currentRatings.map(r => r.social_score);

    const avgX = Math.round(allX.reduce((a, b) => a + b, 0) / allX.length);
    const avgY = Math.round(allY.reduce((a, b) => a + b, 0) / allY.length);

    // Classify Meeting State Quadrant
    let meetingStateKey = 'low_focus_low_social';
    if (avgX >= 50 && avgY >= 50) {
      meetingStateKey = 'high_focus_high_social';
    } else if (avgX < 50 && avgY >= 50) {
      meetingStateKey = 'low_focus_high_social';
    } else if (avgX >= 50 && avgY < 50) {
      meetingStateKey = 'high_focus_low_social';
    }

    const stateConfig = window.MEETING_RECOMMENDATIONS[meetingStateKey];

    // Update State Header UI
    const recMeetingStateTitle = document.getElementById('recMeetingStateTitle');
    const recMeetingStateDesc = document.getElementById('recMeetingStateDesc');
    
    recMeetingStateTitle.textContent = `Team Vibe: ${stateConfig.title}`;
    recMeetingStateDesc.textContent = stateConfig.description;

    // Render recommendations for each person
    const recommendationsList = document.getElementById('recommendationsList');
    recommendationsList.innerHTML = '';

    const personalities = ['Extravert', 'Extravert', 'Ambivert', 'Ambivert', 'Introvert', 'Introvert'];

    currentRatings.forEach((pt, index) => {
      const color = TEAM_COLORS[index % TEAM_COLORS.length];
      const personality = personalities[index % personalities.length];
      const rec = stateConfig[personality.toLowerCase()];

      const item = document.createElement('div');
      item.className = 'recommendation-item';

      // SVG Icon template based on personality nature
      let svgIcon = '';
      if (personality === 'Extravert') {
        svgIcon = `
          <svg class="personality-icon extravert" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
        `;
      } else if (personality === 'Introvert') {
        svgIcon = `
          <svg class="personality-icon introvert" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
          </svg>
        `;
      } else {
        // Ambivert
        svgIcon = `
          <svg class="personality-icon ambivert" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/>
            <path d="M8 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>
          </svg>
        `;
      }

      item.innerHTML = `
        <div class="recommendation-header">
          <div class="rec-avatar" style="background-color: ${color};">P${index + 1}</div>
          <div class="rec-person-info">
            <span class="rec-person-name">Person ${index + 1}</span>
            <span class="rec-person-nature">${personality} Nature</span>
          </div>
          <div class="personality-badge-container">
            ${svgIcon}
            <span class="personality-badge-text">${personality}</span>
          </div>
        </div>
        <div class="recommendation-body">
          <div class="rec-section">
            <span class="rec-label">What could help:</span>
            <span class="rec-action-text">${rec.action}</span>
          </div>
          <div class="rec-section">
            <span class="rec-label">Why it helps the group:</span>
            <span class="rec-why-text">${rec.rationale}</span>
          </div>
        </div>
      `;

      recommendationsList.appendChild(item);
    });
  }

  // Overview Overlay Handlers
  btnBackToGrid.addEventListener('click', () => {
    overviewOverlay.style.display = 'none';
  });

  btnRefreshOverview.addEventListener('click', () => {
    syncSessionRatings();
  });

  // Navigation Handlers
  btnGoToRecommendations.addEventListener('click', () => {
    overviewOverlay.style.display = 'none';
    recommendationsOverlay.style.display = 'flex';
    populateRecommendations();
  });

  btnBackToOverview.addEventListener('click', () => {
    recommendationsOverlay.style.display = 'none';
    overviewOverlay.style.display = 'flex';
  });

  // Run initial session check
  checkSession();
});
