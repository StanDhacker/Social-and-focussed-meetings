/**
 * Supabase-enabled Fullscreen Meeting Reflection Logic
 * Coordinates ratings across multiple users in real-time.
 */

// --------------------------------------------------------------------------
// Supabase Configuration
// Paste your Supabase Project credentials below.
// --------------------------------------------------------------------------
const SUPABASE_URL = "https://gllveefeunusmlrsuysl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsbHZlZWZldW51c21scnN1eXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTExMTIsImV4cCI6MjA5NDgyNzExMn0.vg_2vLgAx3Du16kjTVyqnbrpwIpyTaaHHSI6Tf0eK5s";

document.addEventListener('DOMContentLoaded', () => {
  // State variables
  let supabaseClient = null;
  let sessionId = null;
  let selectedX = null;
  let selectedY = null;
  let isLocked = false;
  let isSubmitted = false;

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
      btnAction.textContent = 'Refresh';
      btnAction.removeAttribute('disabled');

      // Fetch and overlay collective ratings
      syncSessionRatings();
    } else {
      // Clean slate for new feedback
      isSubmitted = false;
      isLocked = false;
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

      const marker = document.createElement('div');
      marker.className = 'team-marker';
      marker.style.left = `${pt.focus_score}%`;
      marker.style.top = `${100 - pt.social_score}%`;
      teamMarkersContainer.appendChild(marker);

      setTimeout(() => {
        marker.classList.add('active');
      }, 50 + index * 80);
    });

    // Calculate statistical averages (including User's locked rating)
    const allX = ratingsList.map(r => r.focus_score);
    const allY = ratingsList.map(r => r.social_score);

    const avgX = Math.round(allX.reduce((a, b) => a + b, 0) / allX.length);
    const avgY = Math.round(allY.reduce((a, b) => a + b, 0) / allY.length);

    // Render collective average marker
    averageMarker.style.left = `${avgX}%`;
    averageMarker.style.top = `${100 - avgY}%`;
    averageMarker.classList.add('active');

    // Update floating dock details
    summaryResults.innerHTML = `
      <div class="summary-row">
        <span><span class="summary-data-label">You:</span><span class="summary-data-value">${selectedX}% F / ${selectedY}% S</span></span>
      </div>
      <div class="summary-row" style="margin-top: 0.15rem;">
        <span><span class="summary-data-label">Team Avg (${ratingsList.length}):</span><span class="summary-data-value">${avgX}% F / ${avgY}% S</span></span>
      </div>
    `;
  }

  // Fallback demo ratings generator
  function renderMockRatings() {
    const mockList = [
      { focus_score: Math.max(5, Math.min(95, selectedX + 15)), social_score: Math.max(5, Math.min(95, selectedY - 10)) },
      { focus_score: Math.max(5, Math.min(95, selectedX - 8)), social_score: Math.max(5, Math.min(95, selectedY + 12)) },
      { focus_score: Math.max(5, Math.min(95, selectedX + 5)), social_score: Math.max(5, Math.min(95, selectedY + 5)) }
    ];
    renderRatings([...mockList, { focus_score: selectedX, social_score: selectedY }]);
    
    summaryResults.innerHTML += `
      <div class="summary-row" style="margin-top: 0.15rem; color: #f59e0b; font-size: 0.7rem;">
        <span>Running in demo mode (credentials unconfigured)</span>
      </div>
    `;
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
      gridTooltip.textContent = `Focus: ${coords.focus}% | Social: ${coords.social}%`;
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
      gridTooltip.textContent = `Focus: ${selectedX}% | Social: ${selectedY}%`;
      
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
    gridTooltip.textContent = `Focus: ${selectedX}% | Social: ${selectedY}%`;
    gridTooltip.style.opacity = '1';

    if (coords.yPercent < 15) {
      gridTooltip.classList.add('tooltip-bottom');
    } else {
      gridTooltip.classList.remove('tooltip-bottom');
    }

    // Display selected coordinates in control dock
    summaryResults.innerHTML = `
      <div class="summary-row">
        <span><span class="summary-data-label">Focus:</span><span class="summary-data-value">${selectedX}%</span></span>
        <span><span class="summary-data-label">Social:</span><span class="summary-data-value">${selectedY}%</span></span>
      </div>
    `;

    btnAction.removeAttribute('disabled');
  });

  // Action Button Submission
  btnAction.addEventListener('click', async () => {
    if (isSubmitted) {
      // REFRESH DATA
      syncSessionRatings();
      return;
    }

    // SUBMIT RATING
    isSubmitted = true;
    gridTooltip.style.opacity = '0';
    btnAction.textContent = 'Refresh';
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

  // Run initial session check
  checkSession();
});
