// EpicScreen Application Main Controller Entrypoint
// Binds all global interactive events, scroll states, search debouncing, and filters.

import { 
  loadDashboard, handleSearch, toggleProfileDrawer, 
  toggleSettingsModal, triggerVoiceSearch, initAIChatBot, 
  updateHeaderProfile, loadLiveTV, loadSubscriptionPlans,
  loadAboutPage, loadTVShows, loadLoginPage, loadSignUpPage,
  checkAuthState, showEpicToast
} from "./ui.js?v=4";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Dashboard and Header
  const loggedIn = checkAuthState();
  if (!loggedIn) {
    loadLoginPage();
  } else {
    loadDashboard();
    updateHeaderProfile();
    initAIChatBot();
  }

  // 2. Scroll Header styling
  const header = document.querySelector("header");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 40) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });

  // 3. Bind Navigation & Logo click (resets filters and search)
  const logo = document.getElementById("header-logo");
  if (logo) {
    logo.onclick = () => {
      resetSearchAndMoods();
    };
  }

  const navLinks = ["nav-home", "nav-movies", "nav-tvshows", "nav-livetv", "nav-plans", "nav-about"];
  navLinks.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.onclick = (e) => {
        e.preventDefault();
        
        // Block premium pages if logged out
        const authenticated = localStorage.getItem("epicscreen_logged_in") !== "false";
        if (!authenticated && id !== "nav-plans" && id !== "nav-about") {
          loadLoginPage();
          showEpicToast("Please login to access this premium content.", "info");
          return;
        }

        setActiveNavLink(id);
        
        // Clear search input on navigation change
        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "";

        if (id === "nav-home") {
          loadDashboard();
        } else if (id === "nav-movies") {
          loadDashboard("movie");
        } else if (id === "nav-tvshows") {
          loadTVShows();
        } else if (id === "nav-livetv") {
          loadLiveTV();
        } else if (id === "nav-plans") {
          loadSubscriptionPlans();
        } else if (id === "nav-about") {
          loadAboutPage();
        }
      };
    }
  });

  function setActiveNavLink(activeId) {
    navLinks.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === activeId) el.classList.add("active");
        else el.classList.remove("active");
      }
    });
  }

  // 4. Bind Search Input (with 400ms debounce)
  const searchInput = document.getElementById("search-input");
  let searchDebounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value;

      // Force login if search is typed when unauthenticated
      const authenticated = localStorage.getItem("epicscreen_logged_in") !== "false";
      if (!authenticated && query.trim() !== "") {
        loadLoginPage();
        showEpicToast("Please login to search cosmic cinema.", "info");
        searchInput.value = "";
        return;
      }

      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        handleSearch(query);
      }, 400);
    });
  }

  // 5. Bind Voice Search Button
  const voiceBtn = document.getElementById("voice-search-btn");
  if (voiceBtn) {
    voiceBtn.onclick = () => {
      const authenticated = localStorage.getItem("epicscreen_logged_in") !== "false";
      if (!authenticated) {
        loadLoginPage();
        showEpicToast("Please login to use voice search.", "info");
        return;
      }
      triggerVoiceSearch();
    };
  }

  // 6. Bind Profile switching pill
  const profilePill = document.getElementById("header-profile-pill");
  if (profilePill) {
    profilePill.onclick = () => {
      toggleProfileDrawer();
    };
  }

  // 7. Bind Core Settings trigger
  const settingsBtn = document.getElementById("header-settings-btn");
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      const authenticated = localStorage.getItem("epicscreen_logged_in") !== "false";
      if (!authenticated) {
        loadLoginPage();
        showEpicToast("Please login to adjust core configuration.", "info");
        return;
      }
      toggleSettingsModal();
    };
  }

  // 8. Bind Mood Selection pills
  const moodPills = document.querySelectorAll(".mood-pill");
  moodPills.forEach(pill => {
    pill.onclick = () => {
      const authenticated = localStorage.getItem("epicscreen_logged_in") !== "false";
      if (!authenticated) {
        loadLoginPage();
        showEpicToast("Please login to filter by cinematic vibe.", "info");
        return;
      }

      const isActive = pill.classList.contains("active");
      
      // Remove active from all others
      moodPills.forEach(p => p.classList.remove("active"));
      
      if (isActive) {
        // Toggle off
        loadDashboard();
        updateAmbientVeil("");
      } else {
        pill.classList.add("active");
        const mood = pill.dataset.mood;
        loadDashboard(mood);
        updateAmbientVeil(mood);
      }
    };
  });

  // 9. AI chatbot assistant panel drawer trigger
  const aiToggle = document.getElementById("ai-toggle");
  const aiDrawer = document.getElementById("ai-chat-drawer");
  const aiClose = document.getElementById("ai-chat-close");

  if (aiToggle && aiDrawer) {
    aiToggle.onclick = () => {
      aiDrawer.classList.toggle("active");
    };
  }

  if (aiClose && aiDrawer) {
    aiClose.onclick = () => {
      aiDrawer.classList.remove("active");
    };
  }

  // Listener for profile changed events (e.g. from features.js)
  window.addEventListener("profileChanged", (e) => {
    updateHeaderProfile();
  });

  // 10. Bind Footer About click trigger
  const footerTrigger = document.getElementById("footer-about-trigger");
  if (footerTrigger) {
    footerTrigger.onclick = () => {
      setActiveNavLink("nav-about");
      loadAboutPage();
      window.scrollTo(0, 0);
    };
  }
});

// Reset search box inputs and select all categories
function resetSearchAndMoods() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  
  const moodPills = document.querySelectorAll(".mood-pill");
  moodPills.forEach(p => p.classList.remove("active"));
  
  // Set home nav active
  const navLinks = ["nav-home", "nav-movies", "nav-tvshows", "nav-livetv", "nav-plans", "nav-about"];
  navLinks.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === "nav-home") el.classList.add("active");
      else el.classList.remove("active");
    }
  });

  loadDashboard();
  updateAmbientVeil("");
}

// Adjust ambient glow depending on the selected mood filter
function updateAmbientVeil(mood) {
  const aurora1 = document.querySelector(".aurora-1");
  const aurora2 = document.querySelector(".aurora-2");
  
  if (!aurora1 || !aurora2) return;

  // Custom colors for moods
  if (mood === "adrenaline") {
    aurora1.style.background = "radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, transparent 70%)"; // Red
    aurora2.style.background = "radial-gradient(circle, rgba(249, 115, 22, 0.4) 0%, transparent 70%)"; // Orange
  } else if (mood === "mindbend") {
    aurora1.style.background = "radial-gradient(circle, rgba(0, 229, 255, 0.4) 0%, transparent 70%)"; // Cyan
    aurora2.style.background = "radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, transparent 70%)"; // Violet
  } else if (mood === "cozy") {
    aurora1.style.background = "radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, transparent 70%)"; // Amber
    aurora2.style.background = "radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)"; // Green
  } else if (mood === "romantic") {
    aurora1.style.background = "radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, transparent 70%)"; // Pink
    aurora2.style.background = "radial-gradient(circle, rgba(217, 70, 239, 0.4) 0%, transparent 70%)"; // Rose
  } else if (mood === "nightwatch") {
    aurora1.style.background = "radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)"; // Blue
    aurora2.style.background = "radial-gradient(circle, rgba(31, 41, 55, 0.5) 0%, transparent 70%)"; // Obsidian gray
  } else {
    // Reset to default
    aurora1.style.background = "radial-gradient(circle, var(--primary-violet) 0%, transparent 70%)";
    aurora2.style.background = "radial-gradient(circle, var(--accent-cyan) 0%, transparent 70%)";
  }
}
