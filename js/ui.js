// EpicScreen UI Controller Module
// Handles movie card rendering, 3D tilt micro-animations, trailer hover previews,
// modal control, profile integrations, and search results display.

import { 
  getMovies, getMovieDetails, searchMovies, getApiKey, saveApiKey, 
  getSimilarMovies, getRecommendedMovies, getSameLanguageMovies, getTrendingMovies,
  isValidMovie, supplementMovies
} from "./tmdb.js?v=4";
import { 
  getActiveProfile, switchProfile, PROFILES, 
  getWatchlist, toggleWatchlist, getAIRecommendations,
  createWatchTogetherRoom, initVoiceSearch
} from "./features.js?v=4";
import { ALL_MOVIES } from "./data.js?v=4";

// Global states
let activeHeroMovie = null;
let heroTrailerTimer = null;
let hoverTrailerTimer = null;
let currentWatchTogetherRoom = null;
let heroMoviesList = [];
let currentHeroIndex = 0;
let heroRotateTimer = null;

// ==========================================
// 1. DASHBOARD MOVIE ROW GENERATION
// ==========================================

export async function loadDashboard(typeOrMood = "") {
  if (localStorage.getItem("epicscreen_logged_in") === "false") {
    loadLoginPage();
    return;
  }

  animateContainerUpdate(() => {
    const container = document.getElementById("categories-container");
    if (!container) return;
    container.innerHTML = ""; // Clear existing rows

    showHeroSlider();

    let activeMood = "";
    if (typeOrMood && typeOrMood !== "movie" && typeOrMood !== "tvShow") {
      activeMood = typeOrMood;
    }

    // Filter compiled 215 items (excluding movies without poster, backdrop, or valid trailer)
    let list = ALL_MOVIES.filter(isValidMovie);
    
    if (typeOrMood === "movie") {
      list = list.filter(m => m.type === "movie");
    } else if (activeMood) {
      list = list.filter(m => m.categories.includes(activeMood));
    }

    // Load Hero Banner from spotlight movies first (up to 5 items for rotation)
    const spotlights = list.filter(m => m.categories.includes("spotlight") && m.type === "movie");
    heroMoviesList = spotlights.length > 0 ? spotlights.slice(0, 5) : list.filter(m => m.type === "movie").slice(0, 5);
    currentHeroIndex = 0;
    
    if (heroMoviesList.length > 0) {
      setupHeroBanner(heroMoviesList[currentHeroIndex]);
      
      // Render dynamic hero bullets
      const bulletsContainer = document.getElementById("hero-bullets");
      if (bulletsContainer) {
        bulletsContainer.innerHTML = "";
        heroMoviesList.forEach((movie, idx) => {
          const bullet = document.createElement("span");
          bullet.className = `bullet ${idx === 0 ? "active" : ""}`;
          bullet.onclick = () => {
            currentHeroIndex = idx;
            switchToHeroMovie(movie);
          };
          bulletsContainer.appendChild(bullet);
        });
      }
      
      startHeroRotation();
    } else {
      stopHeroRotation();
    }

    // 20 OTT Sections
    const sections = [
      { title: "🔥 Trending Movies", key: "Trending Movies" },
      { title: "🌟 Popular Movies", key: "Popular Movies" },
      { title: "🏆 Top Rated Movies", key: "Top Rated Movies" },
      { title: "⚡ Latest Releases", key: "Latest Releases" },
      { title: "⚔️ Action Movies", key: "Action Movies" },
      { title: "😂 Comedy Movies", key: "Comedy Movies" },
      { title: "💖 Romance Movies", key: "Romance Movies" },
      { title: "🕵️ Thriller Movies", key: "Thriller Movies" },
      { title: "👻 Horror Movies", key: "Horror Movies" },
      { title: "👨‍👩‍👧‍👦 Family Movies", key: "Family Movies" },
      { title: "🎯 Telugu Movies", key: "Telugu Movies" },
      { title: "🕶️ Tamil Movies", key: "Tamil Movies" },
      { title: "🕌 Hindi Movies", key: "Hindi Movies" },
      { title: "🌴 Malayalam Movies", key: "Malayalam Movies" },
      { title: "🛡️ Kannada Movies", key: "Kannada Movies" },
      { title: "🇬🇧 English Movies", key: "English Movies" },
      { title: "🍱 Korean Movies", key: "Korean Movies" },
      { title: "🌸 Japanese Movies", key: "Japanese Movies" },
      { title: "🎌 Anime Universe", key: "Anime" },
      { title: "📺 Premium Web Series", key: "Web Series" }
    ];

    sections.forEach(sect => {
      let sectMovies = getMoviesForSection(sect.key, list);
      
      // Only supplement if there is no active mood filter
      if (!activeMood) {
        sectMovies = supplementSectionMovies(sect.key, sectMovies, ALL_MOVIES.filter(isValidMovie));
      }
      
      if (sectMovies.length === 0) return;

      const wrapper = document.createElement("div");
      wrapper.className = "section-wrapper";
      
      const header = document.createElement("div");
      header.className = "section-header";
      header.innerHTML = `
        <h2 class="section-title">${sect.title}</h2>
        <span class="section-viewall">View All</span>
      `;
      wrapper.appendChild(header);

      const row = document.createElement("div");
      row.className = "layout-horizontal";
      
      wrapper.appendChild(row);
      container.appendChild(wrapper);

      renderMovieRow(row, sectMovies, "horizontal");
    });
  });
}

// Render movies array into row
function renderMovieRow(container, movies, layout) {
  if (!movies || movies.length === 0) {
    container.innerHTML = `<div class="settings-label">No movies found in this collection.</div>`;
    return;
  }

  // Limit counts to prevent DOM bloat
  const limit = layout === "spotlight" ? 3 : (layout === "split" ? 4 : (layout === "masonry" ? 5 : 12));
  const renderList = movies.slice(0, limit);

  renderList.forEach((movie) => {
    let card;

    if (layout === "split") {
      // Split layout for critics choice
      card = document.createElement("div");
      card.className = "split-item";
      card.innerHTML = `
        <img class="split-poster" src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
        <div class="split-info">
          <div>
            <h3 class="card-title">${movie.title}</h3>
            <div class="card-meta">
              <span class="card-rating">★ ${movie.vote_average}</span>
              <span>${movie.release_date.split("-")[0]}</span>
            </div>
            <p class="split-quote">"${movie.overview.slice(0, 100)}..."</p>
          </div>
          <span class="card-tags">${movie.awards || "Highly Acclaimed"}</span>
        </div>
      `;
      card.addEventListener("click", () => showMovieDetails(movie.id));
    } else if (layout === "circle") {
      // Circle record disc layout for Musical Hits
      card = document.createElement("div");
      card.className = "circle-card";
      card.innerHTML = `
        <div class="circle-record-disc">
          <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
        </div>
        <div class="circle-title">${movie.title}</div>
      `;
      card.addEventListener("click", () => showMovieDetails(movie.id));
    } else {
      // Standard movie card with 3D Tilt and Trailer Hovers
      card = document.createElement("div");
      card.className = "movie-card";
      card.dataset.id = movie.id;
      
      const rawBackdrop = movie.backdrop_path ? (movie.backdrop_path.startsWith("http") ? movie.backdrop_path : `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`) : (movie.poster_path ? (movie.poster_path.startsWith("http") ? movie.poster_path : `https://image.tmdb.org/t/p/w500${movie.poster_path}`) : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500");
      const backdropSrc = getOptimizedImageUrl(rawBackdrop, "w500");
      
      card.innerHTML = `
        <div class="movie-poster-wrap">
          <img class="movie-poster" src="${backdropSrc}" alt="${movie.title}" loading="lazy">
          <iframe class="card-preview-frame" src="" allow="autoplay; encrypted-media"></iframe>
          <div class="card-glow"></div>
          <div class="card-play-btn-overlay">▶</div>
          <div class="card-overlay">
            <h3 class="card-title">${movie.title}</h3>
            <div class="card-meta">
              <span class="card-rating">★ ${movie.vote_average}</span>
              <span>${movie.release_date.split("-")[0]}</span>
              <span>${movie.runtime ? movie.runtime + "m" : "120m"}</span>
            </div>
            <span class="card-tags">${movie.genres.slice(0, 2).join(" • ")}</span>
          </div>
        </div>
      `;

      // 3D Card Tilt Interaction
      setupCardTilt(card);

      // On-hover Trailer Autoplay Preview
      setupCardTrailerHover(card, movie.youtube_id);

      card.addEventListener("click", (e) => {
        // Prevent click if clicking direct action triggers
        if (e.target.tagName !== "IFRAME") {
          showMovieDetails(movie.id);
        }
      });
    }

    container.appendChild(card);
  });
}

// ==========================================
// 2. HERO BANNER CONTROLLER
// ==========================================

function setupHeroBanner(movie) {
  activeHeroMovie = movie;
  
  const titleEl = document.getElementById("hero-title");
  const metaEl = document.getElementById("hero-meta");
  const taglineEl = document.getElementById("hero-tagline");
  const backdropEl = document.getElementById("hero-backdrop-img");
  const videoContainerEl = document.getElementById("hero-video-container");
  
  if (titleEl) titleEl.innerText = movie.title;
  if (metaEl) {
    metaEl.innerHTML = `
      <span class="hero-rating">★ ${movie.vote_average}</span>
      <span>${movie.release_date.split("-")[0]}</span>
      <span>${movie.runtime} mins</span>
      <span class="hero-age-rating" style="border: 1px solid rgba(255,255,255,0.3); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">${movie.rating || "PG-13"}</span>
      <span style="color: var(--accent-cyan); font-size: 0.85rem; font-weight: 600;">${(movie.languages || []).join(", ")}</span>
      <span style="color: var(--text-gray); font-size: 0.85rem;">${(movie.genres || []).slice(0, 3).join(" • ")}</span>
    `;
  }
  if (taglineEl) taglineEl.innerText = movie.overview.slice(0, 180) + "...";
  
  // Set backdrop image
  const backdropSrc = movie.backdrop_path ? (movie.backdrop_path.startsWith("http") ? movie.backdrop_path : `https://image.tmdb.org/t/p/original${movie.backdrop_path}`) : "";
  if (backdropEl) {
    backdropEl.src = backdropSrc;
    backdropEl.style.opacity = "0.75";
  }

  // Clear existing iframe if there
  const oldIframe = document.getElementById("hero-iframe");
  if (oldIframe) oldIframe.remove();

  // Reset trailer autoplay timer for hero (starts playing after 3 seconds)
  if (heroTrailerTimer) clearTimeout(heroTrailerTimer);
  heroTrailerTimer = setTimeout(() => {
    if (movie.youtube_id && movie.youtube_id !== "Way9Dexny3w") {
      const iframe = document.createElement("iframe");
      iframe.id = "hero-iframe";
      iframe.className = "hero-iframe active";
      iframe.src = `https://www.youtube.com/embed/${movie.youtube_id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${movie.youtube_id}&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1&disablekb=1&fs=0&playsinline=1`;
      iframe.setAttribute("allow", "autoplay; encrypted-media");
      iframe.style.pointerEvents = "none"; // Make iframe completely non-interactive
      videoContainerEl.appendChild(iframe);
      if (backdropEl) backdropEl.style.opacity = "0.2";
    }
  }, 3000);

  // Link button actions
  const playBtn = document.getElementById("hero-play-btn");
  const mylistBtn = document.getElementById("hero-mylist-btn");
  const infoBtn = document.getElementById("hero-info-btn");
  
  if (playBtn) {
    if (!movie.youtube_id || movie.youtube_id === "Way9Dexny3w") {
      playBtn.style.display = "none";
    } else {
      playBtn.style.display = "inline-flex";
      playBtn.onclick = () => playMovieInCustomPlayer(movie.youtube_id, movie.title);
    }
  }
  
  if (mylistBtn) {
    const updateMyListBtn = () => {
      const inList = getWatchlist().includes(movie.id);
      mylistBtn.innerHTML = inList ? "✓ In List" : "➕ My List";
    };
    updateMyListBtn();
    mylistBtn.onclick = () => {
      toggleWatchlist(movie.id);
      updateMyListBtn();
    };
  }

  if (infoBtn) {
    infoBtn.onclick = () => showMovieDetails(movie.id);
  }
}

export function startHeroRotation() {
  if (heroRotateTimer) clearInterval(heroRotateTimer);
  heroRotateTimer = setInterval(() => {
    if (heroMoviesList && heroMoviesList.length > 0) {
      currentHeroIndex = (currentHeroIndex + 1) % heroMoviesList.length;
      switchToHeroMovie(heroMoviesList[currentHeroIndex]);
    }
  }, 8000);
}

export function stopHeroRotation() {
  if (heroRotateTimer) {
    clearInterval(heroRotateTimer);
    heroRotateTimer = null;
  }
}

export function switchToHeroMovie(movie) {
  // Reset the rotation timer on manual interaction
  startHeroRotation();

  const contentEl = document.querySelector(".hero-content");
  const backdropEl = document.getElementById("hero-backdrop-img");
  const iframeEl = document.getElementById("hero-iframe");

  if (contentEl) contentEl.classList.add("fade-out");
  if (backdropEl) backdropEl.classList.add("fade-out");
  if (iframeEl) iframeEl.classList.add("fade-out");

  setTimeout(() => {
    setupHeroBanner(movie);
    
    // Update active class on bullets
    const bullets = document.querySelectorAll("#hero-bullets .bullet");
    bullets.forEach((b, idx) => {
      if (idx === currentHeroIndex) b.classList.add("active");
      else b.classList.remove("active");
    });

    if (contentEl) contentEl.classList.remove("fade-out");
    if (backdropEl) backdropEl.classList.remove("fade-out");
  }, 600);
}

// ==========================================
// 3. MICRO-ANIMATIONS: 3D CARD TILT & GLOW
// ==========================================

function setupCardTilt(card) {
  let rect = null;
  card.addEventListener("mouseenter", () => {
    rect = card.getBoundingClientRect();
  });
  card.addEventListener("mousemove", (e) => {
    if (!rect) rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // x coordinate inside the card
    const y = e.clientY - rect.top;  // y coordinate inside the card

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation (-12deg to 12deg)
    const rotateX = ((centerY - y) / centerY) * 12;
    const rotateY = ((x - centerX) / centerX) * 12;

    card.style.transform = `translate3d(0, -8px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
    
    // Ambient card glow position shifts matching cursor
    const glow = card.querySelector(".card-glow");
    if (glow) {
      const pctX = (x / rect.width) * 100;
      const pctY = (y / rect.height) * 100;
      glow.style.background = `radial-gradient(circle at ${pctX}% ${pctY}%, rgba(0,229,255,0.4) 0%, transparent 60%)`;
      glow.style.borderColor = "transparent";
    }
  });

  card.addEventListener("mouseleave", () => {
    rect = null;
    card.style.transform = "translate3d(0, 0, 0) rotateX(0) rotateY(0) scale(1)";
    const glow = card.querySelector(".card-glow");
    if (glow) {
      glow.style.background = "transparent";
    }
  });
}

// ==========================================
// 4. ON-HOVER TRAILER PREVIEW SYSTEM
// ==========================================

function setupCardTrailerHover(card, youtubeId) {
  const iframe = card.querySelector(".card-preview-frame");
  const poster = card.querySelector(".movie-poster");
  
  if (!iframe || !youtubeId) return;

  card.addEventListener("mouseenter", () => {
    if (hoverTrailerTimer) clearTimeout(hoverTrailerTimer);
    
    // Wait 800ms before playing to make sure user isn't just scrolling past
    hoverTrailerTimer = setTimeout(() => {
      iframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1&origin=${window.location.origin}`;
      iframe.classList.add("active");
      if (poster) poster.style.opacity = "0.1";
    }, 850); // 850ms debounce
  });

  card.addEventListener("mouseleave", () => {
    if (hoverTrailerTimer) clearTimeout(hoverTrailerTimer);
    iframe.src = "";
    iframe.classList.remove("active");
    if (poster) poster.style.opacity = "1";
  });
}

// ==========================================
// 5. IMMERSIVE MOVIE DETAILS MODAL
// ==========================================

export async function showMovieDetails(movieId, autoplayTrailer = false) {
  const modal = document.getElementById("details-modal");
  if (!modal) return;

  const movie = await getMovieDetails(movieId);
  if (!movie) return;

  modal.innerHTML = `
    <div class="modal-card">
      <button class="modal-close-btn" id="modal-close-btn">&times;</button>
      
      <div class="modal-backdrop-hero">
        <img src="https://image.tmdb.org/t/p/original${movie.backdrop_path}" alt="${movie.title}" id="modal-backdrop-img">
        <div class="modal-backdrop-veil"></div>
        <div class="modal-trailer-wrapper" id="modal-trailer-wrap">
          <iframe id="modal-trailer-frame" src="" allow="autoplay; encrypted-media" style="pointer-events: none;"></iframe>
          <div class="modal-trailer-shield" style="position: absolute; top:0; left:0; width:100%; height:100%; z-index:10; background:transparent;"></div>
        </div>
      </div>

      <div class="modal-body">
        <div class="modal-main-row">
          <div class="modal-poster-col">
            <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
            <button class="btn btn-primary" id="modal-play-btn" style="width: 100%; justify-content: center;">
              <span>▶</span> Watch Trailer
            </button>
            <button class="btn btn-accent" id="modal-watchlist-btn" style="width: 100%; justify-content: center;">
              <span>+</span> ${getWatchlist().includes(movie.id) ? "In Watchlist" : "Add to Watchlist"}
            </button>
            <button class="btn btn-accent" id="modal-share-btn" style="width: 100%; justify-content: center; border-color: var(--secondary-gold); color: var(--secondary-gold);">
              <span>🤝</span> Watch Together
            </button>
          </div>

          <div class="modal-info-col">
            <span class="hero-badge">💎 Premium Cinema Selection</span>
            <h1 class="modal-movie-title">${movie.title}</h1>
            
            <div class="modal-movie-meta">
              <span class="hero-rating">★ ${movie.vote_average}</span>
              <span>${movie.release_date.split("-")[0]}</span>
              <span>${movie.runtime} mins</span>
              <span>${movie.rating}</span>
            </div>

            <p class="modal-movie-overview">${movie.overview}</p>

            <div class="modal-badges-grid">
              <div class="badge-item">
                <span>Director</span>
                <span>${movie.director}</span>
              </div>
              <div class="badge-item">
                <span>Starring</span>
                <span>${movie.cast.join(", ")}</span>
              </div>
              <div class="badge-item">
                <span>Quality & Audio</span>
                <span>${movie.quality}</span>
              </div>
              <div class="badge-item">
                <span>Languages & Subs</span>
                <span>Audio: ${movie.languages.join(", ")}<br>Subs: ${movie.subtitles.join(", ")}</span>
              </div>
            </div>

            ${movie.awards ? `
              <div class="settings-input-group" style="margin-top: 1rem;">
                <span class="settings-label">Accolades & Recognition</span>
                <div style="color: var(--secondary-gold); font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem;">
                  🏆 ${movie.awards}
                </div>
              </div>
            ` : ""}

            <div class="settings-input-group" style="margin-top: 1rem;">
              <span class="settings-label">Vibe Quotient</span>
              <div style="display: flex; gap: 0.5rem;">
                <span class="mood-pill active" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;">Adrenaline 85%</span>
                <span class="mood-pill active" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;">Mind Bend 90%</span>
                <span class="mood-pill active" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;">Aesthetic Vibe 100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Clean OTT Recommendations -->
      <div class="modal-recommendations-wrapper" style="padding: 0 3rem 3rem 3rem;">
        <h3 class="section-title" style="font-size: 1.2rem; margin-bottom: 1rem; color: var(--accent-cyan); font-weight: 700; text-align: left;">Similar Movies</h3>
        <div class="layout-horizontal modal-rec-row" id="modal-similar-row" style="gap: 1rem; overflow-x: auto; padding-bottom: 1rem; flex-wrap: nowrap; display: flex;"></div>
        
        <h3 class="section-title" style="font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem; color: var(--primary-violet); font-weight: 700; text-align: left;">More Like This</h3>
        <div class="layout-horizontal modal-rec-row" id="modal-morelike-row" style="gap: 1rem; overflow-x: auto; padding-bottom: 1rem; flex-wrap: nowrap; display: flex;"></div>
      </div>
    </div>
  `;

  // Bind close action
  const closeBtn = modal.querySelector("#modal-close-btn");
  closeBtn.onclick = () => {
    modal.classList.remove("active");
    const frame = modal.querySelector("#modal-trailer-frame");
    if (frame) frame.src = "";
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
      const frame = modal.querySelector("#modal-trailer-frame");
      if (frame) frame.src = "";
    }
  };

  // Watchlist Toggle
  const watchlistBtn = modal.querySelector("#modal-watchlist-btn");
  watchlistBtn.onclick = () => {
    toggleWatchlist(movie.id);
    watchlistBtn.innerHTML = `<span>+</span> ${getWatchlist().includes(movie.id) ? "In Watchlist" : "Add to Watchlist"}`;
  };

  // Watch Together Room Trigger
  const shareBtn = modal.querySelector("#modal-share-btn");
  shareBtn.onclick = () => {
    modal.classList.remove("active");
    const frame = modal.querySelector("#modal-trailer-frame");
    if (frame) frame.src = "";
    toggleWatchTogetherDrawer(movie);
  };

  // Play Movie / Trailer action
  const playBtn = modal.querySelector("#modal-play-btn");
  const trailerWrap = modal.querySelector("#modal-trailer-wrap");
  const trailerFrame = modal.querySelector("#modal-trailer-frame");
  const backdropImg = modal.querySelector("#modal-backdrop-img");

  const startTrailer = () => {
    if (movie.youtube_id && movie.youtube_id !== "Way9Dexny3w" && trailerFrame) {
      trailerFrame.src = `https://www.youtube.com/embed/${movie.youtube_id}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1&disablekb=1&fs=0&playsinline=1&loop=1&playlist=${movie.youtube_id}`;
      trailerWrap.classList.add("active");
      if (backdropImg) backdropImg.style.opacity = "0";
      playBtn.innerHTML = "<span>■</span> Stop Preview";
    }
  };

  const stopTrailer = () => {
    if (trailerFrame) {
      trailerFrame.src = "";
      trailerWrap.classList.remove("active");
      if (backdropImg) backdropImg.style.opacity = "0.5";
      playBtn.innerHTML = "<span>▶</span> Watch Trailer";
    }
  };

  if (playBtn) {
    if (!movie.youtube_id || movie.youtube_id === "Way9Dexny3w") {
      playBtn.style.display = "none";
    } else {
      playBtn.style.display = "inline-flex";
      playBtn.onclick = () => {
        stopTrailer();
        playMovieInCustomPlayer(movie.youtube_id, movie.title);
      };
    }
  }

  // Render Recommendation Posters (De-duplicated)
  const similarRow = modal.querySelector("#modal-similar-row");
  const morelikeRow = modal.querySelector("#modal-morelike-row");

  const renderModalRecs = (rowEl, movieList) => {
    if (!rowEl) return;
    rowEl.innerHTML = "";
    if (!movieList || movieList.length === 0) {
      rowEl.innerHTML = `<div style="font-size:0.85rem; color: var(--text-dim); padding: 1rem 0;">No selections available in this section.</div>`;
      return;
    }
    movieList.forEach(m => {
      const card = document.createElement("div");
      card.className = "modal-rec-card";
      card.style = "flex: 0 0 180px; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden; cursor: pointer; border: 1px solid rgba(255,255,255,0.06); transition: transform 0.3s ease, box-shadow 0.3s ease;";
      
      const backdropSrc = m.backdrop_path ? (m.backdrop_path.startsWith("http") ? m.backdrop_path : `https://image.tmdb.org/t/p/w500${m.backdrop_path}`) : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500";
      card.innerHTML = `<img src="${backdropSrc}" alt="${m.title}" style="width:100%; height:100%; object-fit:cover;" loading="lazy">`;
      
      card.onmouseenter = () => {
        card.style.transform = "scale(1.06) translateY(-4px)";
        card.style.boxShadow = "0 8px 20px rgba(0, 229, 255, 0.4)";
        card.style.borderColor = "var(--accent-cyan)";
      };
      card.onmouseleave = () => {
        card.style.transform = "scale(1) translateY(0)";
        card.style.boxShadow = "none";
        card.style.borderColor = "rgba(255,255,255,0.06)";
      };
      
      card.onclick = () => {
        const frame = modal.querySelector("#modal-trailer-frame");
        if (frame) frame.src = "";
        showMovieDetails(m.id);
      };
      rowEl.appendChild(card);
    });
  };

  // Asynchronously query and load rows
  getSimilarMovies(movie.id).then(list => renderModalRecs(similarRow, list));
  getRecommendedMovies(movie.id).then(list => renderModalRecs(morelikeRow, list));

  modal.classList.add("active");

  if (autoplayTrailer) {
    startTrailer();
  }
}

// ==========================================
// 6. WATCH TOGETHER INTERFACE
// ==========================================

function toggleWatchTogetherDrawer(movie) {
  const drawer = document.getElementById("watch-together-drawer");
  if (!drawer) return;

  drawer.classList.add("active");

  const profile = getActiveProfile();
  currentWatchTogetherRoom = createWatchTogetherRoom(profile.name);

  // Render chat room structure
  drawer.innerHTML = `
    <div class="wt-header">
      <h2 class="wt-title">Watch Together</h2>
      <button class="modal-close-btn" id="wt-close-btn" style="width:36px; height:36px;">&times;</button>
    </div>
    <div class="wt-body">
      <div class="settings-label" style="text-align: center;">Currently Synchronizing:</div>
      <div style="font-weight: 700; text-align: center; color: var(--accent-cyan); font-size:1.1rem; margin-bottom: 1rem;">
        ${movie.title}
      </div>

      <div class="wt-room-code-badge">
        ROOM CODE: ${currentWatchTogetherRoom.roomCode}
      </div>
      
      <div class="settings-label" style="margin-top: 1rem;">Active Participants (4)</div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom: 1rem;">
        <span class="profile-pill" style="padding:0.25rem 0.6rem; font-size:0.75rem;"><span class="profile-avatar">👑</span> ${profile.name}</span>
        <span class="profile-pill" style="padding:0.25rem 0.6rem; font-size:0.75rem;"><span class="profile-avatar">🦊</span> Aria_Synth</span>
        <span class="profile-pill" style="padding:0.25rem 0.6rem; font-size:0.75rem;"><span class="profile-avatar">⚡</span> Leo_Vidal</span>
        <span class="profile-pill" style="padding:0.25rem 0.6rem; font-size:0.75rem;"><span class="profile-avatar">🍷</span> Kira_Neo</span>
      </div>

      <div class="wt-chat-container">
        <div class="wt-chat-logs" id="wt-chat-logs">
          <!-- Chat logs render here -->
        </div>
        <div class="wt-chat-input-row">
          <input type="text" class="ai-chat-input" id="wt-chat-input" placeholder="Say something in room...">
          <button class="ai-send-btn" id="wt-chat-send">➔</button>
        </div>
      </div>
    </div>
  `;

  // Bind close action
  const closeBtn = drawer.querySelector("#wt-close-btn");
  closeBtn.onclick = () => {
    drawer.classList.remove("active");
    if (currentWatchTogetherRoom) {
      currentWatchTogetherRoom.stopSimulation();
      currentWatchTogetherRoom = null;
    }
  };

  const logsEl = drawer.querySelector("#wt-chat-logs");
  const inputEl = drawer.querySelector("#wt-chat-input");
  const sendBtn = drawer.querySelector("#wt-chat-send");

  // Render initial room log messages
  const renderLog = (msgObj) => {
    const el = document.createElement("div");
    el.className = "wt-chat-msg";
    el.innerHTML = `<span>[${msgObj.time}] ${msgObj.sender}:</span> ${msgObj.message}`;
    logsEl.appendChild(el);
    logsEl.scrollTop = logsEl.scrollHeight;
  };

  currentWatchTogetherRoom.chatLog.forEach(renderLog);

  // Hook new messages from simulation
  currentWatchTogetherRoom.onNewMessage(renderLog);

  // Send message action
  const sendMessage = () => {
    const text = inputEl.value.trim();
    if (!text) return;
    currentWatchTogetherRoom.addMessage(profile.name, text);
    inputEl.value = "";
  };

  sendBtn.onclick = sendMessage;
  inputEl.onkeydown = (e) => {
    if (e.key === "Enter") sendMessage();
  };
}

// ==========================================
// 7. PROFILE PANEL & DRAWER CONTROLLER
// ==========================================

export function toggleProfileDrawer() {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;

  const current = getActiveProfile();

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 600px; height: auto; padding: 2.5rem;">
      <button class="modal-close-btn" id="profile-close-btn">&times;</button>
      
      <h2 class="section-title" style="margin-bottom: 2rem; color: var(--primary-violet);">Select Space Identity</h2>
      
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
        ${PROFILES.map(p => `
          <div class="split-item profile-card-select ${p.id === current.id ? 'active' : ''}" 
               data-id="${p.id}" 
               style="cursor:pointer; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 1.5rem; ${p.id === current.id ? 'border-color: var(--accent-cyan); background: rgba(0, 229, 255, 0.05);' : ''}">
            <div style="font-size: 3rem; margin-bottom: 0.5rem; filter: drop-shadow(0 0 10px ${p.color});">${p.avatar}</div>
            <div style="font-weight: 700; font-size:1.1rem; color: #FFF;">${p.name}</div>
            <div style="font-size:0.75rem; color: var(--accent-cyan); margin-top:0.25rem;">Hologram Active</div>
          </div>
        `).join("")}
      </div>

      <div class="settings-input-group">
        <span class="settings-label">Saved Watchlist Items</span>
        <div style="font-size: 0.85rem; color: var(--text-gray);">
          Watchlist syncs automatically to your local browser storage. Feel free to add and remove movies.
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top:1.5rem;">
        <div class="settings-label" style="margin:0;">Identity Controls:</div>
        <button class="btn btn-accent" id="profile-signout-btn" style="border-color: #EF4444; color: #EF4444;">🚪 Sign Out</button>
      </div>
    </div>
  `;

  // Bind close action
  const closeBtn = modal.querySelector("#profile-close-btn");
  closeBtn.onclick = () => modal.classList.remove("active");

  const signoutBtn = modal.querySelector("#profile-signout-btn");
  if (signoutBtn) {
    signoutBtn.onclick = () => {
      localStorage.setItem("epicscreen_logged_in", "false");
      modal.classList.remove("active");
      checkAuthState();
      loadLoginPage();
      showEpicToast("Logged out successfully.", "success");
    };
  }

  // Profile click switching logic
  const profileCards = modal.querySelectorAll(".profile-card-select");
  profileCards.forEach(card => {
    card.onclick = () => {
      const pid = card.dataset.id;
      switchProfile(pid);
      modal.classList.remove("active");
      
      // Reload dashboard immediately for profile favorites
      loadDashboard();
      updateHeaderProfile();
    };
  });

  modal.classList.add("active");
}

export function updateHeaderProfile() {
  const profile = getActiveProfile();
  const avatarEl = document.getElementById("header-profile-avatar");
  const nameEl = document.getElementById("header-profile-name");
  
  if (avatarEl) avatarEl.innerText = profile.avatar;
  if (nameEl) nameEl.innerText = profile.name;
}

// ==========================================
// 8. SETTINGS MANAGEMENT (TMDB KEY INPUT)
// ==========================================

export function toggleSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;

  const currentKey = getApiKey();

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 550px; height: auto; padding: 2.5rem;">
      <button class="modal-close-btn" id="settings-close-btn">&times;</button>
      
      <h2 class="section-title" style="margin-bottom: 1.5rem; color: var(--accent-cyan);">EpicScreen Core Configuration</h2>
      
      <div class="settings-input-group">
        <label class="settings-label">TMDB API Key (Version 3)</label>
        <input type="text" class="settings-textbox" id="settings-api-key" placeholder="Paste your tmdb api_key here..." value="${currentKey}">
        <div style="font-size: 0.75rem; color: var(--text-gray); margin-top:0.5rem; line-height: 1.4;">
          Entering a valid TMDB key redirects content fetches directly to TMDB's servers, loading trending blockbusters, cast listings, and trailers in real time. Leave empty to run in premium cached offline simulation.
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap: 1rem; margin-top:2rem;">
        <button class="btn btn-accent" id="settings-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="settings-save-btn">Save Configurations</button>
      </div>
    </div>
  `;

  // Close actions
  const closeBtn = modal.querySelector("#settings-close-btn");
  const cancelBtn = modal.querySelector("#settings-cancel-btn");
  const saveBtn = modal.querySelector("#settings-save-btn");
  const inputEl = modal.querySelector("#settings-api-key");

  const closeModal = () => modal.classList.remove("active");

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  saveBtn.onclick = () => {
    const key = inputEl.value.trim();
    saveApiKey(key);
    closeModal();
    // Reload dashboard to query live TMDB endpoints or reset back to cache
    loadDashboard();
  };

  modal.classList.add("active");
}

// ==========================================
// 9. SEARCH BAR SYSTEM
// ==========================================

export async function handleSearch(query) {
  stopHeroRotation();
  hideHeroSlider();
  const container = document.getElementById("categories-container");
  if (!container) return;

  if (!query || query.trim() === "") {
    loadDashboard();
    return;
  }

  animateContainerUpdate(async () => {
    // Set Search Results Header
    container.innerHTML = `
      <div class="section-wrapper">
        <div class="section-header">
          <h2 class="section-title">🔍 Search Results for "<span>${query}</span>"</h2>
          <span class="section-viewall" id="search-clear-btn">Clear Search</span>
        </div>
        <div class="layout-horizontal" id="search-results-grid" style="flex-wrap: wrap; height:auto;">
          <!-- Search cards render here -->
        </div>
      </div>
    `;

    const resultsGrid = document.getElementById("search-results-grid");
    const clearBtn = document.getElementById("search-clear-btn");
    
    if (clearBtn) {
      clearBtn.onclick = () => {
        const inputEl = document.getElementById("search-input");
        if (inputEl) inputEl.value = "";
        loadDashboard();
      };
    }

    const matches = await searchMovies(query);
    renderMovieRow(resultsGrid, matches, "horizontal");
  });
}

// ==========================================
// 10. AI RECOMMENDATIONS INTERFACE
// ==========================================

export function initAIChatBot() {
  const inputEl = document.getElementById("ai-chat-input");
  const sendBtn = document.getElementById("ai-send-btn");
  const messagesContainer = document.getElementById("ai-chat-messages");

  if (!inputEl || !sendBtn || !messagesContainer) return;

  const addMessageToChat = (sender, text, movies = []) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${sender}`;
    bubble.innerText = text;
    messagesContainer.appendChild(bubble);

    // If movies are included, render clickable cards inside bubble
    if (movies && movies.length > 0) {
      const cardsGrid = document.createElement("div");
      cardsGrid.className = "ai-card-recommendations";
      
      movies.forEach(m => {
        const card = document.createElement("div");
        card.className = "ai-rec-card";
        card.innerHTML = `
          <img src="https://image.tmdb.org/t/p/w500${m.poster_path}" alt="${m.title}">
          <div class="ai-rec-card-title">${m.title}</div>
        `;
        card.onclick = () => showMovieDetails(m.id);
        cardsGrid.appendChild(card);
      });
      
      bubble.appendChild(cardsGrid);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const processUserMessage = () => {
    const text = inputEl.value.trim();
    if (!text) return;

    addMessageToChat("user", text);
    inputEl.value = "";

    // Show bot typing simulation
    const typingBubble = document.createElement("div");
    typingBubble.className = "chat-message bot";
    typingBubble.innerText = "Analyzing neural logs and movie catalogs...";
    messagesContainer.appendChild(typingBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    setTimeout(() => {
      typingBubble.remove();
      const recs = getAIRecommendations(text);
      addMessageToChat("bot", recs.reply, recs.movies);
    }, 1500);
  };

  sendBtn.onclick = processUserMessage;
  inputEl.onkeydown = (e) => {
    if (e.key === "Enter") processUserMessage();
  };
}

// ==========================================
// 11. VOICE SPEECH OVERLAY CONTROLLER
// ==========================================

export function triggerVoiceSearch() {
  const overlay = document.getElementById("voice-overlay");
  const statusEl = document.getElementById("voice-status");
  const subtextEl = document.getElementById("voice-subtext");
  
  if (!overlay || !statusEl) return;

  overlay.classList.add("active");
  statusEl.innerText = "Listening for Command...";
  if (subtextEl) subtextEl.innerText = "Speak naturally, e.g., 'Recommend sci-fi films'";

  const onResult = (resultText) => {
    statusEl.innerText = `Search for: "${resultText}"`;
    if (subtextEl) subtextEl.innerText = "Routing query to streaming database...";
    
    setTimeout(() => {
      overlay.classList.remove("active");
      const searchInput = document.getElementById("search-input");
      if (searchInput) {
        searchInput.value = resultText;
        handleSearch(resultText);
      }
    }, 1200);
  };

  const onStateChange = (state, errorMsg) => {
    if (state === "listening") {
      statusEl.innerText = "Listening for Space Command...";
    } else if (state === "processing") {
      statusEl.innerText = "Processing vocal coordinates...";
    } else if (state === "idle") {
      // recognition done
    } else if (state === "error") {
      statusEl.innerText = "Vocal Core Error";
      if (subtextEl) subtextEl.innerText = `Speech recognition failed: ${errorMsg || 'Microphone Denied'}`;
      setTimeout(() => overlay.classList.remove("active"), 2000);
    }
  };

  const recognizer = initVoiceSearch(onResult, onStateChange);
  recognizer.start();
}

// ======================================================================
// 12. IMMERSIVE CUSTOM VIDEO PLAYER MODAL (SHIELDED FROM YOUTUBE BRANDING)
// ======================================================================

export function playMovieInCustomPlayer(youtubeId, movieTitle) {
  // Stop hero rotation while playing fullscreen video to prevent background distractions
  stopHeroRotation();

  const modal = document.createElement("div");
  modal.className = "custom-player-modal";
  modal.style = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1000; background: #000; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; font-family: var(--font-main);";
  
  const header = document.createElement("div");
  header.style = "padding: 1.5rem 3rem; background: linear-gradient(180deg, rgba(0,0,0,0.8), transparent); display: flex; justify-content: space-between; align-items: center; z-index: 20;";
  header.innerHTML = `
    <h2 style="font-family: var(--font-heading); font-size: 1.5rem; color: #FFF; font-weight: 700;">${movieTitle}</h2>
    <button id="player-close-btn" style="background: transparent; border: none; font-size: 2rem; color: #FFF; cursor: pointer; transition: transform 0.2s ease;">&times;</button>
  `;
  modal.appendChild(header);

  const playerArea = document.createElement("div");
  playerArea.className = "player-crop-container";
  
  const iframe = document.createElement("iframe");
  iframe.id = "custom-iframe-player";
  iframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1&disablekb=1&fs=0&playsinline=1&origin=${window.location.origin}`;
  iframe.setAttribute("allow", "autoplay; encrypted-media");
  playerArea.appendChild(iframe);

  const shield = document.createElement("div");
  shield.className = "video-shield";
  shield.style = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; background: transparent;";
  playerArea.appendChild(shield);
  
  modal.appendChild(playerArea);

  const controls = document.createElement("div");
  controls.style = "padding: 1.5rem 3rem; background: linear-gradient(0deg, rgba(0,0,0,0.9), transparent); display: flex; align-items: center; justify-content: space-between; gap: 2rem; z-index: 20;";
  
  controls.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1.5rem;">
      <button id="player-play-toggle" style="background: var(--accent-cyan); border: none; color: #000; width: 50px; height: 50px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700; transition: transform 0.2s ease;">■</button>
      <div style="font-size: 0.9rem; color: var(--text-gray); font-weight: 500;">STREAMING IN <span style="color: var(--accent-cyan); font-weight: 700;">4K DOLBY ATMOS</span></div>
    </div>
    <div style="display: flex; align-items: center; gap: 1rem;">
      <button id="player-mute-toggle" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #FFF; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; font-size: 1rem;">🔊</button>
      <input type="range" id="player-volume-slider" min="0" max="100" value="80" style="width: 100px; accent-color: var(--accent-cyan); cursor: pointer;">
    </div>
  `;
  modal.appendChild(controls);
  document.body.appendChild(modal);

  let isPlaying = true;
  let isMuted = false;
  let ytPlayer = null;

  const playToggle = controls.querySelector("#player-play-toggle");
  const muteToggle = controls.querySelector("#player-mute-toggle");
  const volumeSlider = controls.querySelector("#player-volume-slider");
  const closeBtn = header.querySelector("#player-close-btn");

  const cleanClose = () => {
    if (ytPlayer && typeof ytPlayer.destroy === 'function') {
      try {
        ytPlayer.destroy();
      } catch(e) {}
    }
    modal.remove();
    // Restart rotation when player is closed
    startHeroRotation();
  };

  closeBtn.onclick = cleanClose;

  // Initialize YT Player API
  const setupYTAPI = () => {
    ytPlayer = new YT.Player('custom-iframe-player', {
      events: {
        'onStateChange': (event) => {
          if (event.data === YT.PlayerState.ENDED) {
            cleanClose();
          } else if (event.data === YT.PlayerState.PAUSED) {
            playToggle.innerText = "▶";
            playToggle.style.background = "var(--primary-violet)";
            playToggle.style.color = "#FFF";
            isPlaying = false;
          } else if (event.data === YT.PlayerState.PLAYING) {
            playToggle.innerText = "■";
            playToggle.style.background = "var(--accent-cyan)";
            playToggle.style.color = "#000";
            isPlaying = true;
          }
        },
        'onError': (event) => {
          console.warn("YouTube player error encountered in custom fullscreen modal:", event.data);
          cleanClose();
          
          // Find another valid movie and play its trailer instead
          const validMovies = ALL_MOVIES.filter(m => isValidMovie(m) && m.youtube_id !== youtubeId);
          if (validMovies.length > 0) {
            const anotherMovie = validMovies[Math.floor(Math.random() * validMovies.length)];
            playMovieInCustomPlayer(anotherMovie.youtube_id, anotherMovie.title);
          }
        }
      }
    });
  };

  if (window.YT && window.YT.Player) {
    setupYTAPI();
  } else {
    // If API not loaded, inject and poll
    if (!document.getElementById("yt-api-script")) {
      const tag = document.createElement('script');
      tag.id = "yt-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    const checkYT = setInterval(() => {
      if (window.YT && window.YT.Player) {
        setupYTAPI();
        clearInterval(checkYT);
      }
    }, 100);
  }

  playToggle.onclick = () => {
    if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') {
      if (isPlaying) {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        playToggle.innerText = "▶";
        playToggle.style.background = "var(--primary-violet)";
        playToggle.style.color = "#FFF";
      } else {
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        playToggle.innerText = "■";
        playToggle.style.background = "var(--accent-cyan)";
        playToggle.style.color = "#000";
      }
      isPlaying = !isPlaying;
      return;
    }

    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
    }
  };

  muteToggle.onclick = () => {
    if (!ytPlayer || typeof ytPlayer.isMuted !== 'function') {
      if (isMuted) {
        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
        muteToggle.innerText = "🔊";
      } else {
        iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
        muteToggle.innerText = "🔇";
      }
      isMuted = !isMuted;
      return;
    }

    if (ytPlayer.isMuted()) {
      ytPlayer.unMute();
      muteToggle.innerText = "🔊";
    } else {
      ytPlayer.mute();
      muteToggle.innerText = "🔇";
    }
  };

  volumeSlider.oninput = (e) => {
    const vol = e.target.value;
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(vol);
    } else {
      iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[' + vol + ']}', '*');
    }
  };
}

export function loadLiveTV() {
  stopHeroRotation();
  hideHeroSlider();
  
  animateContainerUpdate(() => {
    const container = document.getElementById("categories-container");
    if (!container) return;
    
    const heroIframe = document.getElementById("hero-iframe");
    if (heroIframe) heroIframe.remove();

    container.innerHTML = `
      <div class="live-tv-container">
        <div class="live-channel-list">
          <h3 class="section-title" style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--accent-cyan);">Live Guide</h3>
          <div class="live-channel-item active" data-youtube="y1-w1p0oWd0" data-title="Epic Action Hub" data-logo="🎬">
            <div class="live-channel-logo">🎬</div>
            <div class="live-channel-details">
              <h4>Epic Action Hub</h4>
              <p>LIVE • Kalki Special</p>
            </div>
          </div>
          <div class="live-channel-item" data-youtube="shW9i6k8cB0" data-title="Cine-SciFi Live" data-logo="🚀">
            <div class="live-channel-logo">🚀</div>
            <div class="live-channel-details">
              <h4>Cine-SciFi Live</h4>
              <p>LIVE • Multiverse Tour</p>
            </div>
          </div>
          <div class="live-channel-item" data-youtube="ByXuk9QqQkk" data-title="Anime Studio Stream" data-logo="🎌">
            <div class="live-channel-logo">🎌</div>
            <div class="live-channel-details">
              <h4>Anime Studio Stream</h4>
              <p>LIVE • Miyazaki Special</p>
            </div>
          </div>
          <div class="live-channel-item" data-youtube="0pdqf4P9MB8" data-title="Broadway Live" data-logo="🎤">
            <div class="live-channel-logo">🎤</div>
            <div class="live-channel-details">
              <h4>Broadway Live</h4>
              <p>LIVE • La La Land Remaster</p>
            </div>
          </div>
        </div>

        <div class="live-player-area">
          <div class="live-player-wrapper">
            <iframe id="live-player-iframe" src="https://www.youtube.com/embed/y1-w1p0oWd0?autoplay=1&mute=1&controls=0&loop=1&playlist=y1-w1p0oWd0&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1&disablekb=1&fs=0&playsinline=1" allow="autoplay; encrypted-media"></iframe>
            <div class="live-player-shield"></div>
            
            <div style="position: absolute; top: 1.5rem; left: 1.5rem; z-index: 15; background: rgba(0, 0, 0, 0.6); padding: 0.4rem 0.8rem; border-radius: 8px; backdrop-filter: blur(10px); display: flex; align-items: center; gap: 0.5rem; border: 1px solid rgba(255,255,255,0.08);">
              <span class="live-dot"></span>
              <span style="font-size: 0.75rem; font-weight: 800; color: #FFF; letter-spacing: 1px;">LIVE</span>
              <span style="font-size: 0.75rem; font-weight: 500; color: var(--accent-cyan);">1080p Atmos</span>
            </div>
          </div>
          
          <div class="live-player-controls">
            <div style="display:flex; align-items:center; gap: 1rem;">
              <button id="live-play-toggle" style="background: var(--accent-cyan); border: none; color: #000; width: 40px; height: 40px; border-radius: 50%; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700;">■</button>
              <span id="live-channel-title" style="font-weight: 600; font-size: 0.95rem;">Epic Action Hub</span>
            </div>
            <button id="live-mute-toggle" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #FFF; width: 38px; height: 38px; border-radius: 50%; cursor: pointer;">🔊</button>
          </div>
        </div>

        <div class="live-chat-sidebar">
          <div class="live-chat-header">
            <h3 class="section-title" style="font-size: 1.1rem; color: var(--primary-violet); display: flex; align-items: center; gap: 0.5rem;">
              💬 Live Cine-Chat
            </h3>
          </div>
          <div class="live-chat-messages" id="live-chat-msgs-container"></div>
        </div>
      </div>
    `;

    const chatContainer = container.querySelector("#live-chat-msgs-container");
    const chatSimMessages = [
      { user: "Aria_Synth", text: "This stream quality is stunning! 🍿" },
      { user: "Leo_Vidal", text: "Atmos mix is hitting so good right now" },
      { user: "Kira_Neo", text: "Is this the IMAX Enhanced trailer?" },
      { user: "NolanFan_99", text: "Yes! Visuals are incredible." },
      { user: "BollywoodCine", text: "Kalki VFX are absolutely world-class" },
      { user: "MiyazakiSoul", text: "Spirited Away soundtrack gets me every single time" },
      { user: "Specter_X", text: "No latency/buffering at all. EpicScreen is top tier" },
      { user: "Wolverine_Slash", text: "Deadpool theme track is stuck in my head since yesterday lol" }
    ];

    const injectMessage = () => {
      if (!chatContainer) return;
      const msg = chatSimMessages[Math.floor(Math.random() * chatSimMessages.length)];
      const el = document.createElement("div");
      el.className = "live-chat-msg-item";
      el.innerHTML = `<span class="user">${msg.user}:</span> <span class="text">${msg.text}</span>`;
      chatContainer.appendChild(el);
      chatContainer.scrollTop = chatContainer.scrollHeight;
      
      if (chatContainer.children.length > 25) {
        chatContainer.children[0].remove();
      }
    };

    for (let i = 0; i < 6; i++) {
      injectMessage();
    }

    const interval = setInterval(() => {
      if (document.querySelector(".live-tv-container")) {
        injectMessage();
      } else {
        clearInterval(interval);
      }
    }, 2500);
  });
}

export function loadSubscriptionPlans() {
  stopHeroRotation();
  hideHeroSlider();

  animateContainerUpdate(() => {
    const container = document.getElementById("categories-container");
    if (!container) return;

    container.innerHTML = `
      <div class="plans-container">
        <div class="plans-header">
          <h1>Experience Cinema Beyond Screens</h1>
          <p>Choose an EpicScreen pass to unlock premium 4K UHD, Dolby Vision, and unlimited Sync watchrooms.</p>
        </div>

        <div class="plans-grid">
          <div class="plan-card">
            <div class="plan-name">Epic Pass Lite</div>
            <div class="plan-price">$4.99<span>/month</span></div>
            <ul class="plan-features">
              <li>HD Quality Streaming</li>
              <li>Ad-supported access</li>
              <li>1 Active screen</li>
              <li>Stereo 5.1 audio</li>
            </ul>
            <button class="btn btn-accent plan-btn" id="sub-lite-btn">Subscribe Lite</button>
          </div>

          <div class="plan-card featured">
            <div class="plan-name">Epic Pass Premium</div>
            <div class="plan-price">$9.99<span>/month</span></div>
            <ul class="plan-features">
              <li>4K UHD Streaming</li>
              <li>No ads interruptions</li>
              <li>2 Active screens</li>
              <li>Dolby Atmos audio</li>
              <li>Custom AI Neural Recommendations</li>
            </ul>
            <button class="btn btn-primary plan-btn" id="sub-prem-btn">Subscribe Premium</button>
          </div>

          <div class="plan-card">
            <div class="plan-name">Epic IMAX Elite</div>
            <div class="plan-price">$14.99<span>/month</span></div>
            <ul class="plan-features">
              <li>IMAX Enhanced Streaming</li>
              <li>4K UHD Dolby Vision</li>
              <li>4 Active screens concurrent</li>
              <li>Dolby Atmos & DTS-X audio</li>
              <li>Unlimited Watch Together Sync rooms</li>
              <li>Full profile watchlist sync</li>
            </ul>
            <button class="btn btn-accent plan-btn" id="sub-elite-btn">Subscribe IMAX Elite</button>
          </div>
        </div>
      </div>
    `;

    const subLite = document.getElementById("sub-lite-btn");
    const subPrem = document.getElementById("sub-prem-btn");
    const subElite = document.getElementById("sub-elite-btn");

    if (subLite) {
      subLite.onclick = () => showEpicToast("Epic Pass Lite has been activated successfully on your Cinephile Profile.", "success");
    }
    if (subPrem) {
      subPrem.onclick = () => showEpicToast("Epic Pass Premium has been activated successfully on your Cinephile Profile.", "success");
    }
    if (subElite) {
      subElite.onclick = () => showEpicToast("Epic IMAX Elite has been activated successfully on your Cinephile Profile.", "success");
    }
  });
}

export function loadAboutPage() {
  stopHeroRotation();
  hideHeroSlider();

  animateContainerUpdate(() => {
    const container = document.getElementById("categories-container");
    if (!container) return;

    container.innerHTML = `
      <div class="about-container" style="max-width: 800px; margin: 4rem auto; padding: 2rem; font-family: var(--font-main); text-align: center; color: var(--text-white);">
        <h1 style="font-family: var(--font-heading); font-size: 2.5rem; font-weight: 800; margin-bottom: 1.5rem; letter-spacing: -0.5px;">About EpicScreen</h1>
        
        <p style="font-size: 1.15rem; line-height: 1.8; color: var(--text-gray); margin-bottom: 3rem; font-weight: 300;">
          EpicScreen is a modern OTT streaming platform concept designed to deliver a premium cinematic experience through an intuitive interface, seamless navigation, and visually engaging design.
        </p>
        
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 2.5rem; margin-top: 2rem;">
          <h2 style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem;">Meet the Creator</h2>
          <p style="font-size: 1.4rem; font-weight: 600; color: var(--accent-cyan); margin-bottom: 0.25rem;">Yagna</p>
          <p style="font-size: 0.95rem; text-transform: uppercase; letter-spacing: 2px; color: var(--text-gray); margin-bottom: 1.5rem; font-weight: 600;">Turning Ideas into Interactive Experiences</p>
          <p style="font-size: 1rem; color: var(--text-dim); font-weight: 400; line-height: 1.6; max-width: 500px; margin: 0 auto;">
            Passionate about creating modern, scalable, and user-friendly digital experiences.
          </p>
        </div>
      </div>
    `;
  });
}

// ======================================================================
// 16. MOVIE OTT SECTION CLASSIFICATION & SUPPLEMENT SYSTEM
// ======================================================================

export function getMoviesForSection(sectionName, list) {
  switch (sectionName) {
    case 'Trending Movies':
      return list.filter(m => m.type === 'movie' && (m.categories.includes('trending') || m.categories.includes('todayObsession')));
    case 'Popular Movies':
      return list.filter(m => m.type === 'movie' && (m.categories.includes('hiddenGems') || m.categories.includes('adrenaline') || parseFloat(m.vote_average) >= 7.5));
    case 'Top Rated Movies':
      return list.filter(m => m.type === 'movie' && (m.categories.includes('criticsChoice') || m.categories.includes('awardWinners') || parseFloat(m.vote_average) >= 8.0));
    case 'Latest Releases':
      return list.filter(m => m.type === 'movie' && (m.categories.includes('spotlight') || m.release_date.startsWith('2024') || m.release_date.startsWith('2023') || m.release_date.startsWith('2022')));
    case 'Action Movies':
      return list.filter(m => m.type === 'movie' && m.genres.some(g => g.toLowerCase().includes('action') || g.toLowerCase().includes('adventure')));
    case 'Comedy Movies':
      return list.filter(m => m.type === 'movie' && m.genres.some(g => g.toLowerCase().includes('comedy')));
    case 'Romance Movies':
      return list.filter(m => m.type === 'movie' && m.genres.some(g => g.toLowerCase().includes('romance')));
    case 'Thriller Movies':
      return list.filter(m => m.type === 'movie' && m.genres.some(g => g.toLowerCase().includes('thriller') || g.toLowerCase().includes('mystery') || g.toLowerCase().includes('crime')));
    case 'Horror Movies':
      return list.filter(m => m.type === 'movie' && m.genres.some(g => g.toLowerCase().includes('horror')));
    case 'Family Movies':
      return list.filter(m => m.type === 'movie' && m.genres.some(g => g.toLowerCase().includes('family') || g.toLowerCase().includes('kids') || g.toLowerCase().includes('drama')));
    case 'Telugu Movies':
      return list.filter(m => m.type === 'movie' && m.languages.includes('Telugu'));
    case 'Tamil Movies':
      return list.filter(m => m.type === 'movie' && m.languages.includes('Tamil'));
    case 'Hindi Movies':
      return list.filter(m => m.type === 'movie' && m.languages.includes('Hindi'));
    case 'Malayalam Movies':
      return list.filter(m => m.type === 'movie' && m.languages.includes('Malayalam'));
    case 'Kannada Movies':
      return list.filter(m => m.type === 'movie' && m.languages.includes('Kannada'));
    case 'English Movies':
      return list.filter(m => m.type === 'movie' && m.languages.includes('English'));
    case 'Korean Movies':
      return list.filter(m => m.type === 'movie' && m.languages.includes('Korean'));
    case 'Japanese Movies':
      return list.filter(m => m.type === 'movie' && m.languages.includes('Japanese'));
    case 'Anime':
      return list.filter(m => m.genres.some(g => g.toLowerCase().includes('animation')) || m.categories.includes('animeUniverse') || m.categories.includes('directorMiyazaki'));
    case 'Web Series':
      return list.filter(m => m.type === 'tv');
    default:
      return [];
  }
}

export function supplementSectionMovies(sectionKey, filteredMovies, allList) {
  if (filteredMovies.length >= 12) return filteredMovies;
  
  const movieIds = new Set(filteredMovies.map(m => m.id));
  const supplemented = [...filteredMovies];
  
  let candidates = [];
  if (["Telugu Movies", "Tamil Movies", "Malayalam Movies", "Kannada Movies"].includes(sectionKey)) {
    candidates = allList.filter(m => m.type === 'movie' && m.categories.includes('indianBlockbusters'));
  } else if (sectionKey === "Korean Movies" || sectionKey === "Japanese Movies" || sectionKey === "Anime") {
    candidates = allList.filter(m => m.type === 'movie' && (m.languages.includes('Japanese') || m.languages.includes('Korean') || m.categories.includes('animeUniverse')));
  } else {
    candidates = allList.filter(m => m.type === 'movie' && (m.categories.includes('trending') || m.categories.includes('todayObsession')));
  }
  
  for (const c of candidates) {
    if (supplemented.length >= 15) break;
    if (!movieIds.has(c.id)) {
      supplemented.push(c);
      movieIds.add(c.id);
    }
  }
  
  if (supplemented.length < 12) {
    const backupCandidates = allList.filter(m => m.type === 'movie');
    for (const c of backupCandidates) {
      if (supplemented.length >= 15) break;
      if (!movieIds.has(c.id)) {
        supplemented.push(c);
        movieIds.add(c.id);
      }
    }
  }
  
  return supplemented;
}

// ======================================================================
// 17. HERO SLIDER DYNAMIC VISIBILITY SYSTEM
// ======================================================================

export function hideHeroSlider() {
  const hero = document.querySelector(".hero-showcase");
  const mood = document.querySelector(".mood-bar");
  if (hero) hero.style.display = "none";
  if (mood) mood.style.display = "none";
}

export function showHeroSlider() {
  const hero = document.querySelector(".hero-showcase");
  const mood = document.querySelector(".mood-bar");
  if (hero) hero.style.display = "flex";
  if (mood) mood.style.display = "flex";
}

// ======================================================================
// 18. TV SHOWS PAGE LOADER (NO HERO BANNER)
// ======================================================================

export function loadTVShows() {
  if (localStorage.getItem("epicscreen_logged_in") === "false") {
    loadLoginPage();
    return;
  }

  stopHeroRotation();
  hideHeroSlider();
  
  animateContainerUpdate(() => {
    const container = document.getElementById("categories-container");
    if (!container) return;
    container.innerHTML = "";
    
    const list = ALL_MOVIES.filter(isValidMovie).filter(m => m.type === 'tv');
    
    const sections = [
      { title: "🔥 Trending Series", key: "trending" },
      { title: "🎭 Drama Masterpieces", genres: ["Drama"] },
      { title: "🚀 Sci-Fi & Fantasy Series", genres: ["Science Fiction", "Fantasy", "Sci-Fi & Fantasy", "Action & Adventure"] },
      { title: "💥 Action & Thriller Series", genres: ["Action", "Thriller", "Crime"] },
      { title: "🦊 Anime Series", genres: ["Animation"] }
    ];
    
    sections.forEach(sect => {
      let sectShows = [];
      if (sect.key === "trending") {
        sectShows = list.filter(m => m.categories.includes("trending") || m.categories.includes("todayObsession") || parseFloat(m.vote_average) >= 8.2);
      } else {
        sectShows = list.filter(m => m.genres.some(g => sect.genres.includes(g)));
      }
      
      if (sectShows.length === 0) return;
      
      sectShows = Array.from(new Set(sectShows)).slice(0, 15);
      
      const wrapper = document.createElement("div");
      wrapper.className = "section-wrapper";
      
      const header = document.createElement("div");
      header.className = "section-header";
      header.innerHTML = `
        <h2 class="section-title">${sect.title}</h2>
        <span class="section-viewall">View All</span>
      `;
      wrapper.appendChild(header);
      
      const row = document.createElement("div");
      row.className = "layout-horizontal";
      
      wrapper.appendChild(row);
      container.appendChild(wrapper);
      
      renderMovieRow(row, sectShows, "horizontal");
    });
  });
}

// ======================================================================
// 19. AUTHENTICATION PAGES (LOGIN & SIGN UP)
// ======================================================================

export function loadLoginPage() {
  stopHeroRotation();
  hideHeroSlider();
  
  animateContainerUpdate(() => {
    const container = document.getElementById("categories-container");
    if (!container) return;
    container.innerHTML = `
      <div class="auth-container">
        <div class="auth-particles" id="auth-particles"></div>
        <div class="auth-card">
          <div class="auth-logo">Epic<span>Screen</span></div>
          <h2 class="auth-heading">Welcome Back</h2>
          <form class="auth-form" id="login-form">
            <div class="auth-field">
              <label for="login-email">Email Address</label>
              <input type="email" id="login-email" required placeholder="Enter your email">
            </div>
            <div class="auth-field">
              <label for="login-password">Password</label>
              <div class="password-input-wrap">
                <input type="password" id="login-password" required placeholder="Enter your password">
                <button type="button" class="btn-toggle-password" id="toggle-password-btn">👁️</button>
              </div>
            </div>
            <div class="auth-options">
              <label class="checkbox-label">
                <input type="checkbox" id="login-remember">
                <span>Remember Me</span>
              </label>
              <a href="#" class="auth-link" id="forgot-password-link">Forgot Password?</a>
            </div>
            <button type="submit" class="btn btn-primary auth-submit-btn">Login</button>
          </form>
          
          <div class="auth-divider"><span>or continue with</span></div>
          
          <div class="auth-social-row">
            <button class="btn btn-accent social-btn" id="social-google">
              <img src="https://lh3.googleusercontent.com/COxit4gJr1sICBg1t9DU5Jt5Rthg8QHPTWCg48jqbqA684yr1UT-1Ad251lH7Jj3w64" alt="Google" style="width: 16px; height: 16px; margin-right: 8px;"> Google
            </button>
            <button class="btn btn-accent social-btn" id="social-github">
              <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" style="width: 16px; height: 16px; margin-right: 8px; filter: invert(1);"> GitHub
            </button>
            <button class="btn btn-accent social-btn" id="social-apple">
              <span style="font-size: 1.1rem; margin-right: 8px;"></span> Apple
            </button>
          </div>
          
          <div class="auth-footer">
            Don't have an account? <a href="#" id="go-to-signup" class="auth-link" style="color: var(--accent-cyan);">Sign Up</a>
          </div>
        </div>
      </div>
    `;
    
    createAuthParticles();
    
    const toggleBtn = document.getElementById("toggle-password-btn");
    const passwordInput = document.getElementById("login-password");
    if (toggleBtn && passwordInput) {
      toggleBtn.onclick = () => {
        if (passwordInput.type === "password") {
          passwordInput.type = "text";
          toggleBtn.innerText = "🔒";
        } else {
          passwordInput.type = "password";
          toggleBtn.innerText = "👁️";
        }
      };
    }
    
    const forgotLink = document.getElementById("forgot-password-link");
    if (forgotLink) {
      forgotLink.onclick = (e) => {
        e.preventDefault();
        showEpicToast("Password recovery link sent to your email.", "info");
      };
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.onsubmit = (e) => {
        e.preventDefault();
        localStorage.setItem("epicscreen_logged_in", "true");
        checkAuthState();
        loadDashboard();
        showEpicToast("Access Granted. Syncing space coordinates...", "success");
      };
    }

    const socialGoogle = document.getElementById("social-google");
    const socialGithub = document.getElementById("social-github");
    const socialApple = document.getElementById("social-apple");
    const handleSocialLogin = (provider) => {
      localStorage.setItem("epicscreen_logged_in", "true");
      checkAuthState();
      loadDashboard();
      showEpicToast(`Access Granted via ${provider}. Syncing profile...`, "success");
    };
    if (socialGoogle) socialGoogle.onclick = () => handleSocialLogin("Google");
    if (socialGithub) socialGithub.onclick = () => handleSocialLogin("GitHub");
    if (socialApple) socialApple.onclick = () => handleSocialLogin("Apple");

    const signupRedirection = document.getElementById("go-to-signup");
    if (signupRedirection) {
      signupRedirection.onclick = (e) => {
        e.preventDefault();
        loadSignUpPage();
      };
    }
  });
}

export function loadSignUpPage() {
  stopHeroRotation();
  hideHeroSlider();
  
  animateContainerUpdate(() => {
    const container = document.getElementById("categories-container");
    if (!container) return;
    container.innerHTML = `
      <div class="auth-container">
        <div class="auth-particles" id="auth-particles"></div>
        <div class="auth-card">
          <div class="auth-logo">Epic<span>Screen</span></div>
          <h2 class="auth-heading">Create Account</h2>
          <form class="auth-form" id="signup-form">
            <div class="auth-field">
              <label for="signup-name">Full Name</label>
              <input type="text" id="signup-name" required placeholder="Enter your full name">
            </div>
            <div class="auth-field">
              <label for="signup-email">Email Address</label>
              <input type="email" id="signup-email" required placeholder="Enter your email">
            </div>
            <div class="auth-field">
              <label for="signup-password">Password</label>
              <div class="password-input-wrap">
                <input type="password" id="signup-password" required placeholder="Create password">
                <button type="button" class="btn-toggle-password" id="toggle-signup-password">👁️</button>
              </div>
            </div>
            <div class="auth-field">
              <label for="signup-confirm">Confirm Password</label>
              <div class="password-input-wrap">
                <input type="password" id="signup-confirm" required placeholder="Confirm password">
                <button type="button" class="btn-toggle-password" id="toggle-confirm-password">👁️</button>
              </div>
            </div>
            <button type="submit" class="btn btn-primary auth-submit-btn">Create Account</button>
          </form>
          
          <div class="auth-divider"><span>or sign up with</span></div>
          
          <div class="auth-social-row">
            <button class="btn btn-accent social-btn" id="social-google-signup">
              <img src="https://lh3.googleusercontent.com/COxit4gJr1sICBg1t9DU5Jt5Rthg8QHPTWCg48jqbqA684yr1UT-1Ad251lH7Jj3w64" alt="Google" style="width: 16px; height: 16px; margin-right: 8px;"> Google
            </button>
            <button class="btn btn-accent social-btn" id="social-github-signup">
              <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" style="width: 16px; height: 16px; margin-right: 8px; filter: invert(1);"> GitHub
            </button>
            <button class="btn btn-accent social-btn" id="social-apple-signup">
              <span style="font-size: 1.1rem; margin-right: 8px;"></span> Apple
            </button>
          </div>
          
          <div class="auth-footer">
            Already have an account? <a href="#" id="go-to-login" class="auth-link" style="color: var(--accent-cyan);">Login</a>
          </div>
        </div>
      </div>
    `;
    
    createAuthParticles();
    
    const togglePassBtn = document.getElementById("toggle-signup-password");
    const signupPass = document.getElementById("signup-password");
    if (togglePassBtn && signupPass) {
      togglePassBtn.onclick = () => {
        if (signupPass.type === "password") {
          signupPass.type = "text";
          togglePassBtn.innerText = "🔒";
        } else {
          signupPass.type = "password";
          togglePassBtn.innerText = "👁️";
        }
      };
    }

    const toggleConfirmBtn = document.getElementById("toggle-confirm-password");
    const confirmPass = document.getElementById("signup-confirm");
    if (toggleConfirmBtn && confirmPass) {
      toggleConfirmBtn.onclick = () => {
        if (confirmPass.type === "password") {
          confirmPass.type = "text";
          toggleConfirmBtn.innerText = "🔒";
        } else {
          confirmPass.type = "password";
          toggleConfirmBtn.innerText = "👁️";
        }
      };
    }
    
    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
      signupForm.onsubmit = (e) => {
        e.preventDefault();
        if (signupPass.value !== confirmPass.value) {
          showEpicToast("Passwords do not match.", "error");
          return;
        }
        localStorage.setItem("epicscreen_logged_in", "true");
        checkAuthState();
        loadDashboard();
        showEpicToast("Account created successfully. Welcome to EpicScreen!", "success");
      };
    }

    const socialGoogle = document.getElementById("social-google-signup");
    const socialGithub = document.getElementById("social-github-signup");
    const socialApple = document.getElementById("social-apple-signup");
    const handleSocialSignup = (provider) => {
      localStorage.setItem("epicscreen_logged_in", "true");
      checkAuthState();
      loadDashboard();
      showEpicToast(`Account registered and logged in via ${provider}!`, "success");
    };
    if (socialGoogle) socialGoogle.onclick = () => handleSocialSignup("Google");
    if (socialGithub) socialGithub.onclick = () => handleSocialSignup("GitHub");
    if (socialApple) socialApple.onclick = () => handleSocialSignup("Apple");

    const loginRedirection = document.getElementById("go-to-login");
    if (loginRedirection) {
      loginRedirection.onclick = (e) => {
        e.preventDefault();
        loadLoginPage();
      };
    }
  });
}

// ======================================================================
// 20. SECURITY AUTHENTICATION STATE & NOTIFICATION PLUGINS
// ======================================================================

export function checkAuthState() {
  const isLoggedIn = localStorage.getItem("epicscreen_logged_in") !== "false";
  const profilePill = document.getElementById("header-profile-pill");
  
  let loginBtn = document.getElementById("header-login-btn");
  if (!loginBtn) {
    loginBtn = document.createElement("button");
    loginBtn.id = "header-login-btn";
    loginBtn.className = "btn btn-primary";
    loginBtn.style = "padding: 0.45rem 1.4rem; font-size: 0.8rem; border-radius: 20px; box-shadow: none; font-weight:600;";
    loginBtn.innerText = "Login";
    loginBtn.onclick = () => {
      loadLoginPage();
    };
    if (profilePill) {
      profilePill.parentNode.insertBefore(loginBtn, profilePill);
    }
  }
  
  if (isLoggedIn) {
    if (profilePill) profilePill.style.display = "flex";
    if (loginBtn) loginBtn.style.display = "none";
  } else {
    if (profilePill) profilePill.style.display = "none";
    if (loginBtn) loginBtn.style.display = "block";
  }
  
  return isLoggedIn;
}

export function showEpicToast(message, type = "info") {
  const existing = document.querySelector(".epic-toast");
  if (existing) existing.remove();
  
  const toast = document.createElement("div");
  toast.className = `epic-toast ${type}`;
  
  let icon = "✨";
  if (type === "success") icon = "✅";
  else if (type === "error") icon = "❌";
  else if (type === "info") icon = "ℹ️";
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function createAuthParticles() {
  const container = document.getElementById("auth-particles");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < 20; i++) {
    const p = document.createElement("div");
    p.className = "auth-particle";
    p.style.width = Math.random() * 8 + 4 + "px";
    p.style.height = p.style.width;
    p.style.left = Math.random() * 100 + "%";
    p.style.top = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 5 + "s";
    p.style.animationDuration = Math.random() * 10 + 6 + "s";
    container.appendChild(p);
  }
}

// ======================================================================
// 21. PERFORMANCE ENHANCEMENTS: IMAGE OPTIMIZATION & CONTAINER FADE
// ======================================================================

export function getOptimizedImageUrl(url, size = "w500") {
  if (!url) return "";
  if (url.includes("/original/")) {
    return url.replace("/original/", `/${size}/`);
  }
  return url;
}

export function animateContainerUpdate(updateFn) {
  const container = document.getElementById("categories-container");
  if (!container) {
    updateFn();
    return;
  }
  container.classList.add("fade-out");
  setTimeout(() => {
    updateFn();
    // Force browser reflow to restart transition smoothly
    void container.offsetWidth;
    container.classList.remove("fade-out");
  }, 220);
}
