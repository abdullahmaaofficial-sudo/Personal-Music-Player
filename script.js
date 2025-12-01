// ----- core elements -----
const audio = document.getElementById("audio_id");
const title = document.getElementById("song-title");
const playBtn = document.getElementById("play_btn");
const nextBtn = document.getElementById("next_btn");
const prevBtn = document.getElementById("previous_btn");
const progress = document.getElementById("progress");
const volumeSlider = document.getElementById("volume");
const shuffleBtn = document.getElementById("shuffle_btn");
const repeatBtn = document.getElementById("repeat_btn");
const currentTimeDisplay = document.getElementById("current-time");
const totalTimeDisplay = document.getElementById("total-time");
const playlistElement = document.getElementById("playlist-items");
const playIcon = document.getElementById("play_icon");
const volumeIcon = document.getElementById("volume_icon");

const audioCard = document.querySelector(".audio_card");
const musicSign = document.querySelector(".music_sign");

// songs array: note some are local; user added songs will have { userAdded: true }
const songs = [
  { name: "Sahiba", path: "Music/ssvid.net--Sahiba-Lyrics-Aditya-Rikhari-saahiba-aaye-ghar-kaahe.mp3" },
  { name: "Har Funn Maula", path: "Music/Har Funn Maula.mp4" },
  { name: "Afusic - Pal Pal", path: "Music/Afusic - Pal Pal with @Talwiinder  (Official Visualiser) Prod. @AliSoomroMusic.mp4" },
  { name: "AUR - TU HAI KAHAN", path: "Music/AUR - TU HAI KAHAN - Raffey - Usama - Ahad (Official Music Video).mp4" },
  { name: "Hasan Raheem - Wishes", path: "Music/Hasan Raheem - Wishes ft Talwiinder - Prod by Umair (Official Lyric Video).mp4" },
  { name: "Jaanan -( Slow and Reverb )", path: "Music/Jaanan -( Slow and Reverb )-- Hadiqa Kiani ft Irfan Khan 🎵- Lofi Songs - SHX MUSIC -.mp4" },
  { name: "JANI - Since Tum ", path: "Music/JANI - Since Tum ft. @TalhaAnjum  - Prod by  @superdupersultan.mp4" },
  { name: "Jokhay, Talha Anjum", path: "Music/Jokhay, Talha Anjum  - Laapata (Official Audio).mp4" },
  { name: "KSI - So Far Away", path: "Music/KSI - So Far Away (feat. S-X) [Official Lyric Video].mp4" },
  { name: "Rovalio_Abdul Hannan-Bikhra", path: "Music/Rovalio _ Abdul Hannan - Bikhra (Official Music Video).mp4" },
  { name: "Talha Anjum - Lost In Time", path: "Music/Talha Anjum - Lost In Time _ Prod. by Umair (Official Audio).mp4" },
  { name: "Talha Anjum - Secrets", path: "Music/Talha Anjum - Secrets - Prod. by Umair (Official Audio).mp4" },
  { name: "KSI - Dirty [Official Visualiser]", path: "Music/KSI - Dirty [Official Visualiser].mp4" },
];

// Storage functions - FIXED: These were missing
function saveSongsToStorage() {
  try {
    // Only save user-added songs to avoid overwriting original playlist
    const userAddedSongs = songs.filter(song => song.userAdded);
    localStorage.setItem('musicPlayerSongs', JSON.stringify(userAddedSongs));
  } catch (e) {
    console.warn('Could not save songs:', e);
  }
}

function loadSavedSongs() {
  try {
    const savedSongs = localStorage.getItem('musicPlayerSongs');
    const savedCurrentSong = localStorage.getItem('musicPlayerCurrentSong');
    
    if (savedSongs) {
      const parsed = JSON.parse(savedSongs);
      // Add saved songs to the existing songs array
      parsed.forEach(song => {
        if (song.userAdded && !songs.some(s => s.path === song.path)) {
          songs.push(song);
        }
      });
    }
    
    // Restore current song index if it exists and is valid
    if (savedCurrentSong !== null) {
      const savedIndex = parseInt(savedCurrentSong);
      if (savedIndex >= 0 && savedIndex < songs.length) {
        currentSong = savedIndex;
      }
    }
  } catch (e) {
    console.warn('Could not load saved songs:', e);
  }
}

function saveCurrentSong() {
  try {
    localStorage.setItem('musicPlayerCurrentSong', currentSong.toString());
  } catch (e) {
    console.warn('Could not save current song:', e);
  }
}

let currentSong = 0;
let isShuffle = false;
let isRepeat = false;
let lastVolume = parseFloat(volumeSlider.value) || 1;

// --- YouTube player state ---
let ytPlayer = null;
let usingYouTube = false;
let ytUpdateInterval = null;

// Utility: detect if URL is youtube
function isYouTubeUrl(url) {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i.test(url);
}

function extractYouTubeId(url) {
  if (!url) return null;
  // common patterns
  const ytMatch = url.match(
    /(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?#]|$)/
  );
  if (ytMatch && ytMatch[1]) return ytMatch[1];
  // youtu.be short link
  const shortMatch = url.match(/youtu\.be\/([0-9A-Za-z_-]{11})/);
  if (shortMatch && shortMatch[1]) return shortMatch[1];
  return null;
}

// ----- YouTube API setup (global callback required by API) -----
let youtubeApiReady = false;

window.onYouTubeIframeAPIReady = function() {
  console.log('YouTube API ready, creating player...');
  youtubeApiReady = true;
  
  // create player in the container but keep it hidden until used
  ytPlayer = new YT.Player("youtube-player-container", {
    height: "0",
    width: "0",
    videoId: "",
    playerVars: {
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      autoplay: 0,
      enablejsapi: 1,
      origin: window.location.origin
    },
    events: {
      onStateChange: onPlayerStateChange,
      onReady: (event) => {
        console.log('YouTube player ready and functional');
        // Set initial volume
        if (ytPlayer.setVolume) {
          ytPlayer.setVolume(Math.round(lastVolume * 100));
        }
        
        // If there's a pending YouTube song to load, load it now
        if (pendingYouTubeLoad) {
          console.log('Loading pending YouTube video:', pendingYouTubeLoad);
          ytPlayer.loadVideoById(pendingYouTubeLoad);
          pendingYouTubeLoad = null;
        }
      },
      onError: (event) => {
        console.error('YouTube player error:', event.data);
        // Try to handle the error gracefully
        title.textContent = songs[currentSong]?.name + " (YouTube Error)";
      }
    }
  });
};

// Check if API is already loaded
if (typeof YT !== 'undefined' && YT.Player) {
  console.log('YouTube API already available');
  window.onYouTubeIframeAPIReady();
}

// Track pending YouTube loads
let pendingYouTubeLoad = null;

// When YouTube player's state changes - sync UI
function onPlayerStateChange(event) {
  // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
  if (event.data === YT.PlayerState.ENDED) {
    if (isRepeat) {
      ytPlayer.seekTo(0);
      ytPlayer.playVideo();
    } else {
      nextSong();
    }
  } else if (event.data === YT.PlayerState.PLAYING) {
    playIcon.src = "icons/pause.svg";
    startVisualizer();
  } else if (event.data === YT.PlayerState.PAUSED) {
    playIcon.src = "icons/play.svg";
    stopVisualizer();
  } else if (event.data === YT.PlayerState.BUFFERING) {
    // optional: show a buffering clue
  }
}

// ----- load / play / pause -----
function loadSong(index) {
  const song = songs[index];
  if (!song) return;

  console.log('Loading song:', song.name, song.path);

  // Update title & highlight
  title.textContent = song.name || "Unknown";
  highlightCurrentSong(index);

  // Reset indicators
  audioCard.classList.remove("online-active", "local-active");
  musicSign.classList.remove("online-active", "local-active");

  // STOP any playing source
  stopYouTubeIfPlaying();
  audio.pause();

  // If it's a YouTube link -> prepare YouTube
  if (isYouTubeUrl(song.path)) {
    const vid = extractYouTubeId(song.path);
    console.log('YouTube video ID:', vid);
    console.log('YouTube API ready:', youtubeApiReady);
    console.log('YouTube player:', ytPlayer);
    
    if (vid) {
      usingYouTube = true;
      audio.src = ""; // clear audio source
      audio.load();
      audioCard.classList.add("online-active");
      musicSign.classList.add("online-active");

      if (youtubeApiReady && ytPlayer && ytPlayer.loadVideoById) {
        try {
          console.log('Loading YouTube video immediately:', vid);
          ytPlayer.loadVideoById(vid, 0, "small");
          startYouTubeProgressUpdater();
        } catch (e) {
          console.error('Error loading YouTube video:', e);
          // Fallback: try cueVideoById
          try {
            ytPlayer.cueVideoById(vid);
            console.log('Fallback: cued video');
          } catch (e2) {
            console.error('Cue video also failed:', e2);
          }
        }
      } else {
        console.warn('YouTube player not ready, storing video ID for later');
        pendingYouTubeLoad = vid;
        
        // Try again after a delay
        let retryCount = 0;
        const retryLoad = () => {
          retryCount++;
          console.log(`Retry attempt ${retryCount} for YouTube video:`, vid);
          
          if (youtubeApiReady && ytPlayer && ytPlayer.loadVideoById) {
            try {
              ytPlayer.loadVideoById(vid, 0, "small");
              startYouTubeProgressUpdater();
              console.log('YouTube video loaded on retry');
              return;
            } catch (e) {
              console.error('Retry failed:', e);
            }
          }
          
          // Try again if we haven't exceeded retry limit
          if (retryCount < 5) {
            setTimeout(retryLoad, 1000);
          } else {
            console.error('Failed to load YouTube video after 5 retries');
            title.textContent = song.name + " (Failed to load)";
          }
        };
        
        setTimeout(retryLoad, 500);
      }
    } else {
      usingYouTube = false;
      console.warn('Could not extract YouTube video ID from:', song.path);
      title.textContent = song.name + " (Invalid YouTube URL)";
      currentTimeDisplay.textContent = "00:00";
      totalTimeDisplay.textContent = "00:00";
    }
    updatePlayIconForCurrent();
    return;
  }

  // else treat as regular audio (local or direct online audio file)
  usingYouTube = false;
  audio.src = song.path;
  audio.load();

  // If path starts with http(s) -> show online indicator
  if (/^https?:\/\//i.test(song.path)) {
    audioCard.classList.add("online-active");
    musicSign.classList.add("online-active");
  } else {
    // Local file -> show local indicator
    audioCard.classList.add("local-active");
    musicSign.classList.add("local-active");
  }

  audio.addEventListener("loadedmetadata", () => {
    totalTimeDisplay.textContent = formatTime(audio.duration || 0);
    updateProgress();
  }, { once: true });

  // Handle audio loading errors
  audio.addEventListener("error", (e) => {
    console.error('Audio loading error:', e);
    title.textContent = song.name + " (Error loading)";
  }, { once: true });

  updatePlayIconForCurrent();
}

// Play/pause logic checks which player is active
function playPause() {
  console.log('Play/Pause clicked, usingYouTube:', usingYouTube);
  
  if (usingYouTube) {
    if (!ytPlayer) {
      console.warn('YouTube player not available');
      return;
    }
    
    try {
      const state = ytPlayer.getPlayerState();
      console.log('YouTube player state:', state);
      
      if (state === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
      } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.CUED || state === YT.PlayerState.ENDED) {
        ytPlayer.playVideo();
      } else {
        // If video is not loaded, try to load and play
        const currentSongData = songs[currentSong];
        if (currentSongData && isYouTubeUrl(currentSongData.path)) {
          const vid = extractYouTubeId(currentSongData.path);
          if (vid) {
            ytPlayer.loadVideoById(vid);
            setTimeout(() => ytPlayer.playVideo(), 100);
          }
        }
      }
    } catch (e) {
      console.error('YouTube playback error:', e);
    }
  } else {
    if (audio.paused) {
      audio.play().catch(e => console.log('Play failed:', e));
    } else {
      audio.pause();
    }
  }
}

function updatePlayIconForCurrent() {
  if (usingYouTube) {
    const st = ytPlayer ? ytPlayer.getPlayerState() : -1;
    playIcon.src = (st === YT.PlayerState.PLAYING) ? "icons/pause.svg" : "icons/play.svg";
  } else {
    playIcon.src = audio.paused ? "icons/play.svg" : "icons/pause.svg";
  }
}

// ----- next / prev / shuffle / repeat -----
function nextSong() {
  if (isShuffle) {
    currentSong = Math.floor(Math.random() * songs.length);
  } else {
    currentSong = (currentSong + 1) % songs.length;
  }
  saveCurrentSong();
  loadSong(currentSong);
  playAfterLoad();
}

function prevSong() {
  currentSong = (currentSong - 1 + songs.length) % songs.length;
  saveCurrentSong();
  loadSong(currentSong);
  playAfterLoad();
}

function playAfterLoad() {
  // small delay to ensure sources are ready
  setTimeout(() => {
    if (usingYouTube) {
      if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo();
    } else {
      audio.play().catch(e => console.log('Auto-play blocked:', e));
    }
  }, 150);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  shuffleBtn.style.background = isShuffle ? "#00ffcc22" : "";
}

function toggleRepeat() {
  isRepeat = !isRepeat;
  repeatBtn.style.background = isRepeat ? "#00ffcc22" : "";
}

// ----- progress / time display -----
function updateProgress() {
  if (usingYouTube) return; // YT progress handled by interval updater
  if (!audio.duration) return;
  progress.value = (audio.currentTime / audio.duration) * 100;
  currentTimeDisplay.textContent = formatTime(audio.currentTime);
  totalTimeDisplay.textContent = formatTime(audio.duration);
}

function setProgress() {
  if (usingYouTube) {
    if (!ytPlayer) return;
    const targetSec = (progress.value / 100) * (ytPlayer.getDuration() || 0);
    ytPlayer.seekTo(targetSec, true);
    return;
  }
  if (!audio.duration) return;
  const seekTime = (progress.value / 100) * audio.duration;
  audio.currentTime = seekTime;
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

// ----- volume / mute -----
function updateVolumeIcon() {
  if (usingYouTube && ytPlayer) {
    // YT volume is 0-100
    const vol = (ytPlayer.isMuted && ytPlayer.isMuted()) ? 0 : (ytPlayer.getVolume ? ytPlayer.getVolume() / 100 : lastVolume);
    volumeIcon.src = (vol === 0) ? "icons/mute.svg" : "icons/volume.svg";
    return;
  }
  volumeIcon.src = (audio.muted || audio.volume === 0) ? "icons/mute.svg" : "icons/volume.svg";
}

volumeIcon.addEventListener("click", () => {
  if (usingYouTube && ytPlayer) {
    if (ytPlayer.isMuted && ytPlayer.isMuted()) {
      ytPlayer.unMute();
      ytPlayer.setVolume((lastVolume || 1) * 100);
      volumeSlider.value = lastVolume;
    } else {
      if (ytPlayer.mute) ytPlayer.mute();
      lastVolume = parseFloat(volumeSlider.value) || 1;
      volumeSlider.value = 0;
    }
    updateVolumeIcon();
    return;
  }

  if (!audio.muted && audio.volume > 0) {
    lastVolume = audio.volume;
    audio.muted = true;
    volumeSlider.value = 0;
    audio.volume = 0;
  } else {
    audio.muted = false;
    audio.volume = lastVolume || 1;
    volumeSlider.value = audio.volume;
  }
  updateVolumeIcon();
});

volumeSlider.addEventListener("input", () => {
  if (usingYouTube && ytPlayer) {
    const v = parseFloat(volumeSlider.value);
    lastVolume = v;
    if (ytPlayer.setVolume) ytPlayer.setVolume(Math.round(v * 100));
    if (v > 0 && ytPlayer.unMute) ytPlayer.unMute();
    updateVolumeIcon();
    return;
  }
  audio.muted = false;
  audio.volume = parseFloat(volumeSlider.value);
  lastVolume = audio.volume;
  updateVolumeIcon();
});

audio.addEventListener("volumechange", updateVolumeIcon);

// wheel volume
audioCard.addEventListener("wheel", (e) => {
  e.preventDefault();
  let delta = e.deltaY < 0 ? 0.05 : -0.05;
  if (usingYouTube && ytPlayer) {
    let v = (ytPlayer.getVolume ? ytPlayer.getVolume() / 100 : (lastVolume || 1)) + delta;
    v = Math.min(1, Math.max(0, v));
    if (ytPlayer.setVolume) ytPlayer.setVolume(Math.round(v * 100));
    lastVolume = v;
    volumeSlider.value = v;
    updateVolumeIcon();
    return;
  }
  audio.volume = Math.min(1, Math.max(0, audio.volume + delta));
  volumeSlider.value = audio.volume;
  updateVolumeIcon();
});

// ----- playlist -----
function generatePlaylist() {
  playlistElement.innerHTML = "";
  songs.forEach((song, index) => {
    const li = document.createElement("div");
    li.className = "playlist-item";
    li.dataset.index = index;
    
    // Prevent IDM from detecting this as a clickable element
    li.setAttribute('data-no-download', 'true');
    li.setAttribute('unselectable', 'on');

    // Create mini visualizer
    const miniVisHTML = `
      <span class="mini-vis">
        <span class="b" style="--i:0"></span>
        <span class="b" style="--i:1"></span>
        <span class="b" style="--i:2"></span>
        <span class="b" style="--i:3"></span>
        <span class="b" style="--i:4"></span>
      </span>`;

    const textSpan = document.createElement("span");
    textSpan.className = "song-text";
    textSpan.textContent = song.name || "Unknown";

    // Append mini-vis and text
    li.innerHTML = miniVisHTML;
    li.appendChild(textSpan);

    // Add delete button only for user added songs
    if (song.userAdded) {
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.title = "Delete song";
      delBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"></path>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>`;
      
      // FIXED: Better event handling
      delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        deleteSong(index);
      });
      
      li.appendChild(delBtn);
    }

    // FIXED: Better event handling for song selection
    li.addEventListener('click', function(e) {
      // Don't play if clicking delete button
      if (e.target.closest('.delete-btn')) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Clicked song:', index, song.name);
      currentSong = index;
      saveCurrentSong();
      loadSong(currentSong);
      playAfterLoad();
    });

    // Prevent context menu, drag, select
    li.addEventListener("contextmenu", (ev) => ev.preventDefault());
    li.addEventListener("dragstart", (ev) => ev.preventDefault());
    li.addEventListener("selectstart", (ev) => ev.preventDefault());

    playlistElement.appendChild(li);
  });

  highlightCurrentSong(currentSong);
}

function highlightCurrentSong(index) {
  document.querySelectorAll(".playlist-item").forEach((el, i) => {
    el.classList.toggle("active", i === index);
  });
}

// FIXED: Delete song function
function deleteSong(index) {
  console.log('Deleting song at index:', index);
  
  // If deleting currently playing song, stop playback first
  if (index === currentSong) {
    if (usingYouTube) stopYouTubeIfPlaying();
    audio.pause();
  }

  // Remove from array
  songs.splice(index, 1);
  
  // Save to localStorage after deletion
  saveSongsToStorage();

  // Adjust currentSong index
  if (index < currentSong) {
    currentSong -= 1;
  } else if (index === currentSong) {
    // If we deleted the current song, try to play next or previous
    if (songs.length === 0) {
      currentSong = 0;
      title.textContent = "No songs";
      highlightCurrentSong(-1);
    } else {
      currentSong = currentSong % songs.length;
      loadSong(currentSong);
      playAfterLoad();
    }
  }

  // Save the new current song position
  saveCurrentSong();
  
  // Regenerate playlist
  generatePlaylist();
}

// ----- audio end for regular audio -----
audio.addEventListener("ended", () => {
  if (isRepeat) {
    audio.currentTime = 0;
    audio.play();
  } else {
    nextSong();
  }
});
audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("play", () => { updatePlayIconForCurrent(); startVisualizer(); });
audio.addEventListener("pause", () => { updatePlayIconForCurrent(); stopVisualizer(); });

// ----- controls events -----
playBtn.addEventListener("click", playPause);
nextBtn.addEventListener("click", nextSong);
prevBtn.addEventListener("click", prevSong);
progress.addEventListener("input", setProgress);
progress.addEventListener("change", setProgress);
shuffleBtn.addEventListener("click", toggleShuffle);
repeatBtn.addEventListener("click", toggleRepeat);

// ----- keyboard controls -----
document.addEventListener("keydown", (e) => {
  if (e.code === "ArrowRight" && document.activeElement !== volumeSlider) {
    if (usingYouTube && ytPlayer) {
      const t = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() + 5 : 0;
      if (ytPlayer.seekTo) ytPlayer.seekTo(t, true);
    } else audio.currentTime += 5;
  }
  if (e.code === "ArrowLeft" && document.activeElement !== volumeSlider) {
    if (usingYouTube && ytPlayer) {
      const t = Math.max(0, (ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0) - 5);
      if (ytPlayer.seekTo) ytPlayer.seekTo(t, true);
    } else audio.currentTime -= 5;
  }
  if (e.code === "ArrowUp") {
    let v = (usingYouTube && ytPlayer) ? ((ytPlayer.getVolume ? ytPlayer.getVolume() / 100 : lastVolume) + 0.05) : Math.min(1, audio.volume + 0.05);
    if (usingYouTube && ytPlayer) {
      v = Math.min(1, v);
      if (ytPlayer.setVolume) ytPlayer.setVolume(Math.round(v * 100));
      volumeSlider.value = v;
    } else {
      audio.volume = v;
      volumeSlider.value = audio.volume;
    }
    updateVolumeIcon();
  }
  if (e.code === "ArrowDown") {
    let v = (usingYouTube && ytPlayer) ? ((ytPlayer.getVolume ? ytPlayer.getVolume() / 100 : lastVolume) - 0.05) : Math.max(0, audio.volume - 0.05);
    if (usingYouTube && ytPlayer) {
      v = Math.max(0, v);
      if (ytPlayer.setVolume) ytPlayer.setVolume(Math.round(v * 100));
      volumeSlider.value = v;
    } else {
      audio.volume = v;
      volumeSlider.value = audio.volume;
    }
    updateVolumeIcon();
  }
  if (e.code === "Space" && document.activeElement.tagName !== "INPUT") {
    e.preventDefault();
    playPause();
  }
  if (e.code === "KeyM") {
    if (usingYouTube && ytPlayer) {
      if (ytPlayer.isMuted && ytPlayer.isMuted()) {
        ytPlayer.unMute();
        ytPlayer.setVolume((lastVolume || 1) * 100);
        volumeSlider.value = lastVolume;
      } else {
        ytPlayer.mute && ytPlayer.mute();
        lastVolume = parseFloat(volumeSlider.value) || 1;
        volumeSlider.value = 0;
      }
    } else {
      if (!audio.muted && audio.volume > 0) {
        lastVolume = audio.volume;
        audio.muted = true;
        volumeSlider.value = 0;
        audio.volume = 0;
      } else {
        audio.muted = false;
        audio.volume = lastVolume || 1;
        volumeSlider.value = audio.volume;
      }
    }
    updateVolumeIcon();
  }
});

// FIXED: Add Song Button with better error handling and YouTube testing
document.getElementById("add-song-btn").addEventListener("click", () => {
  const nameInput = document.getElementById("song-name-input");
  const urlInput = document.getElementById("song-url-input");

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  console.log('Adding song:', name, url);

  if (name && url) {
    // Check if song already exists
    const existingSong = songs.find(s => s.path === url);
    if (existingSong) {
      alert("This song is already in the playlist!");
      return;
    }

    // Validate YouTube URL if it's a YouTube link
    if (isYouTubeUrl(url)) {
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        alert("Invalid YouTube URL! Please check the URL and try again.");
        return;
      }
      console.log('Valid YouTube URL detected, Video ID:', videoId);
    }

    // Add to songs array
    const newSong = { name: name, path: url, userAdded: true };
    songs.push(newSong);
    
    console.log('Song added:', newSong);
    
    // Save to localStorage
    saveSongsToStorage();
    
    // Regenerate playlist
    generatePlaylist();
    
    // Auto-play the newly added song
    currentSong = songs.length - 1;
    saveCurrentSong();
    loadSong(currentSong);
    
    // Give a small delay before trying to play
    setTimeout(() => {
      playAfterLoad();
    }, 500);

    // Clear inputs
    nameInput.value = "";
    urlInput.value = "";
    
    console.log('Total songs now:', songs.length);
    
    // Show success message
    const originalText = title.textContent;
    title.textContent = "Song Added! Loading...";
    setTimeout(() => {
      if (title.textContent.includes("Song Added!")) {
        title.textContent = originalText;
      }
    }, 2000);
  } else {
    alert("Please enter both song name and URL");
  }
});

// ----- Visualizer -----
let audioCtx, analyser, source, dataArray, bufferLength;
let rafId;

function initVisualizer() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.warn("AudioContext not available");
    return;
  }
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.85;
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  try {
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (e) {
    console.warn('Could not connect audio source:', e);
  }

  createVisualizerBars();
}

function drawVisualizer() {
  // Generate random data for YouTube videos since we can't access their audio
  if (usingYouTube) {
    const fakeDataArray = new Uint8Array(128);
    for (let i = 0; i < fakeDataArray.length; i++) {
      fakeDataArray[i] = Math.random() * 150 + (Math.sin(Date.now() * 0.01 + i) * 30 + 60);
    }
    
    // Animate playlist mini-vis bars
    const activeItem = document.querySelector(".playlist-item.active");
    if (activeItem) {
      const miniBars = activeItem.querySelectorAll(".mini-vis .b");
      miniBars.forEach((bar, idx) => {
        const dataIndex = Math.floor(idx * fakeDataArray.length / miniBars.length);
        const value = (fakeDataArray[dataIndex] || 0) / 255;
        const height = Math.max(0.2, value * 1.5);
        bar.style.transform = `scaleY(${height})`;
        bar.style.opacity = (0.3 + 0.7 * value).toString();
      });
    }

    // Animate edge bars with fake data
    animateEdgeBarsWithData(fakeDataArray);
    
    rafId = requestAnimationFrame(drawVisualizer);
    return;
  }
  // Original code for regular audio
  if (!analyser || !dataArray) {
    rafId = requestAnimationFrame(drawVisualizer);
    return;
  }
  
  analyser.getByteFrequencyData(dataArray);

  // Playlist mini-vis bars animation
  const activeItem = document.querySelector(".playlist-item.active");
  if (activeItem) {
    const miniBars = activeItem.querySelectorAll(".mini-vis .b");
    miniBars.forEach((bar, idx) => {
      const dataIndex = Math.floor(idx * bufferLength / miniBars.length);
      const value = (dataArray[dataIndex] || 0) / 255;
      const height = Math.max(0.2, value * 1.5);
      bar.style.transform = `scaleY(${height})`;
      bar.style.opacity = (0.3 + 0.7 * value).toString();
    });
  }
  // Edge bars animation
  animateEdgeBars();

  rafId = requestAnimationFrame(drawVisualizer);
}

function startVisualizer() {
  if (!audioCtx) initVisualizer();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  cancelAnimationFrame(rafId);
  drawVisualizer();
  musicSign.classList.add('playing');
}

function stopVisualizer() {
  cancelAnimationFrame(rafId);
  musicSign.classList.remove('playing');
}

// Edge bars
function createEdgeBars() {
  if (!edgeBarsContainer) return;
  edgeBarsContainer.innerHTML = '';
  const barCount = 28;
  const startAngle = 45;
  const endAngle = 135;

  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'edge-bar';
    const angle = endAngle - (i * (endAngle - startAngle)) / (barCount - 1);
    const radian = (angle * Math.PI) / 180;
    const radius = 50;
    const x = Math.cos(radian) * radius;
    const y = Math.sin(radian) * radius;
    bar.style.position = 'absolute';
    bar.style.left = `calc(50% + ${x}%)`;
    bar.style.top = `calc(50% + ${y}%)`;
    bar.style.width = '8px';
    bar.style.height = '25px';
    bar.style.transform = `translate(-50%, -100%)`;
    bar.style.transformOrigin = 'bottom center';
    edgeBarsContainer.appendChild(bar);
  }
}

function createVisualizerBars() {
  // This function was referenced but not defined - adding it
  createEdgeBars();
}

function animateEdgeBars() {
  if (!analyser || !dataArray) return;
  const edgeBarElements = document.querySelectorAll('.edge-bar');
  edgeBarElements.forEach((bar, idx) => {
    const dataIndex = Math.floor(idx * bufferLength / edgeBarElements.length);
    const value = (dataArray[dataIndex] || 0) / 255;
    const height = Math.max(0.3, value * 1.8);
    bar.classList.add('active');
    bar.style.transform = bar.style.transform.replace(/scaleY\([^)]*\)/, '') + ` scaleY(${height})`;
    bar.style.opacity = (0.3 + 0.7 * value).toString();
  });
}

function animateEdgeBarsWithData(audioData) {
  const edgeBarElements = document.querySelectorAll('.edge-bar');
  edgeBarElements.forEach((bar, idx) => {
    const dataIndex = Math.floor(idx * audioData.length / edgeBarElements.length);
    const value = (audioData[dataIndex] || 0) / 255;
    const height = Math.max(0.3, value * 1.8);
    bar.classList.add('active');
    bar.style.transform = bar.style.transform.replace(/scaleY\([^)]*\)/, '') + ` scaleY(${height})`;
    bar.style.opacity = (0.3 + 0.7 * value).toString();
  });
}

// ----- YouTube helpers for progress + updates -----
function startYouTubeProgressUpdater() {
  stopYouTubeProgressUpdater();
  if (!ytPlayer) return;
  ytUpdateInterval = setInterval(() => {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
    const dur = ytPlayer.getDuration() || 0;
    const cur = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
    if (dur) {
      progress.value = (cur / dur) * 100;
      currentTimeDisplay.textContent = formatTime(cur);
      totalTimeDisplay.textContent = formatTime(dur);
    } else {
      currentTimeDisplay.textContent = "00:00";
      totalTimeDisplay.textContent = "00:00";
    }
  }, 500);
}

function stopYouTubeProgressUpdater() {
  if (ytUpdateInterval) {
    clearInterval(ytUpdateInterval);
    ytUpdateInterval = null;
  }
}

function stopYouTubeIfPlaying() {
  if (ytPlayer && typeof ytPlayer.stopVideo === "function") {
    try { ytPlayer.stopVideo(); } catch (e) {}
  }
  stopYouTubeProgressUpdater();
  usingYouTube = false;
}

// ----- INITIALIZATION -----
function initializePlayer() {
  loadSavedSongs();
  generatePlaylist();
  loadSong(currentSong);
  audio.volume = lastVolume;
  updateVolumeIcon();
  createEdgeBars();
}

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlayer);
} else {
  initializePlayer();
}

// Keep UI updated when audio metadata/time changes (regular audio)
audio.addEventListener("loadedmetadata", () => {
  totalTimeDisplay.textContent = formatTime(audio.duration || 0);
});

audio.addEventListener("timeupdate", () => {
  if (!usingYouTube) updateProgress();
});

// Additional IDM prevention - FIXED: Better implementation
document.addEventListener('DOMContentLoaded', function() {
  const playlist = document.getElementById('playlist-items');
  if (playlist) {
    // Comprehensive user-select prevention
    const preventSelection = function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    };

    // Apply multiple prevention methods
    playlist.style.webkitUserSelect = 'none';
    playlist.style.mozUserSelect = 'none';
    playlist.style.msUserSelect = 'none';
    playlist.style.userSelect = 'none';
    
    // Prevent various IDM triggers
    playlist.addEventListener('mousedown', preventSelection, true);
    playlist.addEventListener('selectstart', preventSelection, true);
    playlist.addEventListener('dragstart', preventSelection, true);
    playlist.addEventListener('contextmenu', preventSelection, true);
  }
});

// Debug logging for troubleshooting
console.log('Music player script loaded');
console.log('Initial songs count:', songs.length);


// Sidebar functionality
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.querySelector('.sidebar-overlay');

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
});

sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
});
