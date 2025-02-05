let song;
let fft;
let isLoading = false;
const NUM_LINES = 50;       // Maximum number of lines stored
const LINE_SPACING = 4;    // Spacing between lines
const AMPLITUDE = 200;      // Base amplitude of the wave
let isPlaying = false;
let currentHue = 0;
let smoothedVolume = 0;
let smoothedBass = 0;
let smoothedTreble = 0;
const EDGE_PADDING = 50;    // Padding to zero-out the edges
const BASS_INTENSITY = 5;      // Multiplier for bass impact (try 1.0 - 4.0)
const TREBLE_INTENSITY = 5;    // Multiplier for treble impact (try 1.0 - 3.0)
const CURVE_SMOOTHNESS = 0.7;    // Controls curve smoothness (0.1 - 1.0, higher = smoother)
const MAX_CURVES = 3;            // Maximum number of major curves (2 - 5)
const ANIMATION_SPEED = 0.025;   // Speed of animation (0.01 - 0.05, higher = faster)

// Add variables for stars
let stars = [];
const TRAIL_LENGTH = 15;
const STAR_SPEED = 1.5;
const STAR_COUNT = 100;  // Reduced count for cleaner look

// Add color cycling constant
const COLOR_CYCLE_SPEED = 1;  // Consistent speed for color changes
let colorHue = 0;  // Separate from currentHue for independent control

// Add new variables for scrolling title
let titleScrollInterval;
let titleScrollPosition = 0;

function preload() {
  song = loadSound('song2.mp3');
}

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('visualization-container');
  fft = new p5.FFT(0.8, 512);  // Higher FFT resolution
  colorMode(HSL);
  
  // Initialize the lines array
  initializeLines();
  
  // Setup file handling
  setupFileHandling();
  
  // Create UI elements
  createUI();
  
  // Set initial volume
  song.setVolume(0.5);
  
  // Create star positions
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(0.5, 1.5),
      speed: random(STAR_SPEED * 0.5, STAR_SPEED * 1.5),
      angle: random(TWO_PI),
      trail: []
    });
  }
}

function setupFileHandling() {
  let loadButton = select('#loadFileButton');
  let fileInput = select('#fileInput');
  let loading = select('#loading');
  
  loadButton.mousePressed(() => fileInput.elt.click());
  
  fileInput.elt.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    isLoading = true;
    loading.style('display', 'block');
    
    let url = URL.createObjectURL(file);
    loadSound(url, 
      // Success callback
      (loadedSong) => {
        song = loadedSong;
        // Update song title in the UI
        let songName = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension
        select('.song-title').html(songName);
        
        // Setup scrolling if title is too long
        clearInterval(titleScrollInterval);
        let titleElement = select('.song-title');
        let containerWidth = select('.title-scroll-container').width;
        if (titleElement.elt.scrollWidth > containerWidth) {
          titleScrollPosition = 0;
          titleScrollInterval = setInterval(() => {
            titleScrollPosition++;
            if (titleScrollPosition > titleElement.elt.scrollWidth) {
              titleScrollPosition = -containerWidth;
            }
            titleElement.style('transform', `translateX(${-titleScrollPosition}px)`);
          }, 50);
        }
        
        select('#start-menu').style('display', 'none');
        select('#visualization-container').style('display', 'block');
        song.setVolume(0.5);
        isLoading = false;
        loading.style('display', 'none');
      },
      // Error callback
      (error) => {
        console.error('Error loading song:', error);
        isLoading = false;
        loading.style('display', 'none');
      }
    );
  });
}

function initializeLines() {
  // Pre-fill the lines array with empty arrays
  lines = [];
  for (let i = 0; i < NUM_LINES; i++) {
    lines.push(new Array(width).fill(0));
  }
}

function draw() {
  if (!song || !song.isLoaded() || isLoading) {
    setGradientBackground();
    return;
  }
  
  // Update colors continuously regardless of audio
  colorHue = (colorHue + COLOR_CYCLE_SPEED) % 360;
  
  // Draw animated gradient background
  setGradientBackground();
  
  // Audio analysis
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");
  let treble = fft.getEnergy("treble");
  let mid = fft.getEnergy("mid");
  let volume = song.getVolume();
  
  // Smooth audio values with adaptive smoothing factors
  smoothedVolume = lerp(smoothedVolume, volume, 0.15);
  smoothedBass = lerp(smoothedBass, bass, 0.12);
  smoothedTreble = lerp(smoothedTreble, treble, 0.1);
  
  // Update wave lines based on audio analysis
  updateLines(spectrum, smoothedBass, smoothedTreble, mid, smoothedVolume);
  
  // Draw the updated visualization
  drawVisualization();
  
  // Update UI elements (progress bar, time, etc.)
  updateUI();
  
  // Gradually update the color cycle using a dynamic step based on treble
  currentHue = (currentHue + COLOR_CYCLE_SPEED) % 360;
}

function updateLines(spectrum, bass, treble, mid, volume) {
  let newLine = [];
  let step = 5;
  let currentAmplitude = AMPLITUDE * (1 + volume * 0.8);
  let time = frameCount * 0.015;
  
  // Define the center region where the effect should occur
  let centerStart = width * 0.3;  // Start at 30% of width
  let centerEnd = width * 0.7;    // End at 70% of width

  for (let x = 0; x < width; x += step) {
    let index = floor(map(x, 0, width, 0, spectrum.length));
    let value = map(spectrum[index], 0, 255, 0, currentAmplitude);
    
    // Calculate distance from center as a percentage (0 to 1)
    let normalizedX = x / width;
    let distanceFromCenter = abs(normalizedX - 0.5) * 2; // Will be 0 at center, 1 at edges
    
    // Create smooth transition between effect and straight lines
    let transitionMultiplier = 0;
    if (x > centerStart && x < centerEnd) {
      // Smooth transition in the center region
      let normalizedPosition = (x - centerStart) / (centerEnd - centerStart);
      transitionMultiplier = sin(normalizedPosition * PI); // Creates smooth bell curve
    }

    // Apply audio effects only in the center region
    let audioEffect = 0;
    if (transitionMultiplier > 0) {
      let bassWave = sin(time * 0.8 + x * 0.002) * map(bass, 0, 255, 0, 20);
      let trebleWave = sin(time * 2.0 + x * 0.007) * map(treble, 0, 255, 0, 10);
      let midWave = cos(time + x * 0.005) * map(mid, 0, 255, 0, 15);
      
      audioEffect = (bassWave + trebleWave + midWave) * transitionMultiplier;
    }

    // Add some subtle noise for texture in the center
    let noise = random(-2, 2) * transitionMultiplier;
    
    // Combine all effects
    let y = value * transitionMultiplier + audioEffect + noise;
    
    newLine[x] = -y; // Negative to make peaks go up
  }

  lines.unshift(newLine);
  if (lines.length > NUM_LINES) {
    lines.pop();
  }
  // Completely flatten old lines over time
  for (let i = 1; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
      lines[i][j] = lerp(lines[i][j], 0, 0  ); // Adjust the 0.1 value to control flattening speed
    }
  }
}

function drawVisualization() {
  let bassIntensity = map(smoothedBass, 0, 255, 0.8, 1.5);

  for (let i = 0; i < lines.length; i++) {
    let opacity = map(i, 0, lines.length, 1, 0.12);
    let brightness = map(i, 0, lines.length, 90, 35);
    // Use same colorHue for lines
    stroke(colorHue, 100, brightness, opacity);
    strokeWeight(0.5 * bassIntensity); // Changed from 1.5 to 0.5 for thinner lines
    noFill();

    beginShape();
    // Start with straight line
    vertex(0, i * LINE_SPACING + height / 3);
    
    // Draw the main curve with smooth transitions
    for (let x = 0; x < width; x += 5) {
      let yOffset = i * LINE_SPACING + height / 3;
      let y = yOffset + lines[i][x];
      
      if (x === 0 || x >= width - 5) {
        // Use regular vertex for straight edges
        vertex(x, yOffset);
      } else {
        // Use curveVertex for smooth curves in the middle
        curveVertex(x, y);
      }
    }
    
    // End with straight line
    vertex(width, i * LINE_SPACING + height / 3);
    endShape();
  }
}

function createUI() {
  let controls = createDiv('').id('controls');
  controls.html(`
    <div class="player-container">
      <div class="top-controls">
        <div class="song-info">
          <div class="title-scroll-container">
            <div class="song-title-scroll">
              <span class="song-title">Select a song to play</span>
            </div>
          </div>
          <span class="time-display">0:00 / 0:00</span>
        </div>
        <div class="volume-container">
          <i class="volume-icon">🔊</i>
          <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="0.5">
        </div>
      </div>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
      </div>
      <div class="main-controls">
        <button id="playButton" class="play-button">
          <span class="play-icon">▶</span>
        </button>
        <button id="backButton" class="back-button">
          <span>↩</span>
        </button>
      </div>
    </div>
  `);
  
  // Add event listeners for play/pause and volume change
  select('#playButton').mousePressed(togglePlay);
  select('#volumeSlider').input(() => {
    let vol = select('#volumeSlider').value();
    song.setVolume(vol);
    updateVolumeIcon(vol);
  });

  // Back button handler
  select('#backButton').mousePressed(() => {
    clearInterval(titleScrollInterval);
    if (song) {
      song.stop();
      song = null;
    }
    isPlaying = false;
    select('#visualization-container').style('display', 'none');
    select('#start-menu').style('display', 'flex');
    select('#fileInput').elt.value = ''; // Reset file input
  });
}

// Replace the setGradientBackground function with the following:

function setGradientBackground() {
  let ctx = drawingContext;
  // Create a vertical linear gradient as one panel
  let gradient = ctx.createLinearGradient(0, 0, 0, height);
  let topColor = `hsl(${colorHue}, 80%, 10%)`;    // Top color
  let bottomColor = `hsl(${colorHue}, 80%, 2%)`;   // Bottom color
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // ...existing star drawing code...
  push();
  blendMode(SCREEN);
  noStroke();
  stars.forEach(star => {
    // Update star positions, trails, and drawing logic
    star.x += cos(star.angle) * star.speed;
    star.y += sin(star.angle) * star.speed;
    star.trail.unshift({x: star.x, y: star.y});
    if (star.trail.length > TRAIL_LENGTH) star.trail.pop();
    star.trail.forEach((pos, i) => {
      let alpha = map(i, 0, star.trail.length, 0.3, 0);
      fill(colorHue, 50, 80, alpha);
      circle(pos.x, pos.y, star.size);
    });
    if (star.x < 0) star.x = width;
    if (star.x > width) star.x = 0;
    if (star.y < 0) star.y = height;
    if (star.y > height) star.y = 0;
  });
  pop();
}

function updateUI() {
  if (!song || !song.isLoaded() || !song.isPlaying()) return;
  
  let progress = song.currentTime() / song.duration();
  select('.progress-fill').style('width', (progress * 100) + '%');
  
  let currentTime = formatTime(song.currentTime());
  let totalTime = formatTime(song.duration());
  select('.time-display').html(`${currentTime} / ${totalTime}`);
  
  //let volumeScale = map(smoothedVolume, 0, 1, 0.5, 3);
  //document.documentElement.style.setProperty('--intensity-scale', volumeScale);
}

function formatTime(seconds) {
  let minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function togglePlay() {
  if (!song || !song.isLoaded() || isLoading) return;
  
  if (isPlaying) {
    song.pause();
    select('.play-icon').html('▶');
  } else {
    song.play();
    select('.play-icon').html('⏸');
  }
  isPlaying = !isPlaying;
}

function updateVolumeIcon(volume) {
  let icon = select('.volume-icon');
  if (volume > 0.5) icon.html('🔊');
  else if (volume > 0) icon.html('🔉');
  else icon.html('🔇');
}

// Consolidated windowResized function: resize canvas and reinitialize lines.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initializeLines();
}

// Insert modern CSS styles for the UI and overall presentation
document.head.insertAdjacentHTML('beforeend', `
  <style>
    body {
      margin: 0;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    .player-container {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      padding: 15px 20px;
      color: white;
    }
    
    .top-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .song-info {
      display: flex;
      flex-direction: column;
    }
    
    .title-scroll-container {
      width: 300px;
      overflow: hidden;
      position: relative;
    }
    
    .song-title-scroll {
      white-space: nowrap;
      position: relative;
    }
    
    .song-title {
      display: inline-block;
      transition: transform 0.1s linear;
    }
    
    .time-display {
      font-size: 12px;
      opacity: 0.8;
    }
    
    .volume-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .progress-container {
      margin: 10px 0;
    }
    
    .progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: rgb(29, 185, 84);
      width: 0%;
      transition: width 0.1s linear;
    }
    
    .main-controls {
      display: flex;
      justify-content: center;
      margin-top: 10px;
    }
    
    .play-button {
      background: white;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    }
    
    .play-button:hover {
      transform: scale(1.05);
    }
    
    .play-icon {
      color: black;
      font-size: 18px;
    }
    
    input[type="range"] {
      -webkit-appearance: none;
      width: 100px;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      outline: none;
    }
    
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      background: white;
      border-radius: 50%;
      cursor: pointer;
    }
  </style>
`);

document.head.insertAdjacentHTML('beforeend', `
  <style>
    :root {
      --intensity-scale: 1;
    }
    
    .visualization-container {
      transform: scale(var(--intensity-scale));
      transition: transform 0.1s ease;
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(var(--intensity-scale)); }
      100% { transform: scale(1); }
    }
  </style>
`);
