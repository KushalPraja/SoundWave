let song;
let fft;
let lines = [];
const NUM_LINES = 50;  // More lines for fuller effect
const LINE_SPACING = 12;  // Tighter spacing
const AMPLITUDE = 150;  // Higher base amplitude
let isPlaying = false;
let currentHue = 0;
let smoothedVolume = 0;
let smoothedBass = 0;
let smoothedTreble = 0;
const EDGE_PADDING = 50; // Add this line

function preload() {
  song = loadSound('song.mp3');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  fft = new p5.FFT(0.8, 512);  // Higher FFT resolution
  colorMode(HSL);
  
  // Initialize lines with full width
  initializeLines();
  
  // Create UI
  createUI();
  
  // Set initial volume
  song.setVolume(0.5);
}

function initializeLines() {
  lines = [];
  for (let i = 0; i < NUM_LINES; i++) {
    lines[i] = new Array(width).fill(0);
  }
}

function draw() {
  // Animated gradient background
  setGradientBackground();
  
  // Analyze audio (from original draw)
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");
  let treble = fft.getEnergy("treble");
  let mid = fft.getEnergy("mid");
  let volume = song.getVolume();
  
  // Smooth audio values
  smoothedVolume = lerp(smoothedVolume, volume, 0.1);
  smoothedBass = lerp(smoothedBass, bass, 0.1);
  smoothedTreble = lerp(smoothedTreble, treble, 0.1);
  
  // Update lines (from original draw)
  updateLines(spectrum, smoothedBass, smoothedTreble, mid, smoothedVolume);
  
  // Draw visualization (from original draw)
  drawVisualization();
  
  // Update UI
  updateUI();
  
  // Update color cycle
  currentHue = (currentHue + 0.1) % 360;
}

function updateLines(spectrum, bass, treble, mid, volume) {
  lines.pop();
  let newLine = [];
  
  // Calculate base amplitude modified by volume
  let currentAmplitude = AMPLITUDE * (1 + volume);
  
  for (let x = 0; x < width; x++) {
    // Get frequency data
    let index = floor(map(x, 0, width, 0, spectrum.length));
    let value = map(spectrum[index], 0, 255, 0, currentAmplitude);
    
    // Calculate wave shape
    let normalizedX = x / width;
    let distanceFromCenter = abs(normalizedX - 0.5);
    
    // Dynamic falloff based on bass
    let falloffFactor = map(bass, 0, 255, 0.05, 0.02);
    let falloff = exp(-distanceFromCenter * distanceFromCenter / falloffFactor);
    
    // Complex wave calculation
    let time = frameCount * 0.02;
    let bassWave = sin(time * 0.5 + x * 0.002) * map(bass, 0, 255, 0, 30);
    let trebleWave = sin(time * 2 + x * 0.005) * map(treble, 0, 255, 0, 15);
    let midWave = cos(time + x * 0.003) * map(mid, 0, 255, 0, 20);
    
    // Combine all effects
    newLine[x] = (value * falloff) + bassWave + trebleWave + midWave;
  }
  
  lines.unshift(newLine);
}

function drawVisualization() {
  let bassIntensity = map(smoothedBass, 0, 255, 0.5, 1.2);
  let trebleIntensity = map(smoothedTreble, 0, 255, 0.3, 0.8);
  
  for (let i = 0; i < lines.length; i++) {
    let lineOpacity = map(i, 0, lines.length, 1, 0.1);
    let brightness = map(i, 0, lines.length, 80, 40);
    stroke(currentHue, 80, brightness, lineOpacity);
    strokeWeight(2.5 * bassIntensity);
    noFill();
    
    beginShape();
    // Start point
    vertex(0, i * LINE_SPACING + height/4);
    
    // Draw curve points
    for (let x = 0; x < width; x += 4) {  // Step size of 4 for performance
      let y = i * LINE_SPACING + height/4 + (lines[i][x] * trebleIntensity);
      let waveOffset = sin(frameCount * 0.03 + i * 0.1) * 2;
      curveVertex(x, y + waveOffset);
    }
    
    // End point
    vertex(width, i * LINE_SPACING + height/4);
    endShape();
  }
}

function createUI() {
  let controls = createDiv('').id('controls');
  controls.html(`
    <div class="player-container">
      <div class="top-controls">
        <div class="song-info">
          <span class="song-title">Now Playing</span>
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
      </div>
    </div>
  `);
  
  // Add event listeners
  select('#playButton').mousePressed(togglePlay);
  select('#volumeSlider').input(() => {
    let vol = select('#volumeSlider').value();
    song.setVolume(vol);
    updateVolumeIcon(vol);
  });
}


function setGradientBackground() {
  let c1 = color(currentHue, 20, 15);
  let c2 = color((currentHue + 180) % 360, 20, 8);
  
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(c1, c2, inter);
    stroke(c);
    line(0, y, width, y);
  }
}

function updateVisualizer() {
  strokeWeight(2.5);
  stroke(currentHue, 80, 80, 0.8);
  noFill();
  
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");
  let treble = fft.getEnergy("treble");
  
  // Update lines
  lines.pop();
  let newLine = [];
  for (let x = 0; x < width; x++) {
    let index = floor(map(x, 0, width, 0, spectrum.length));
    let value = map(spectrum[index], 0, 255, 0, AMPLITUDE);
    
    if (x < EDGE_PADDING || x > width - EDGE_PADDING) {
      newLine[x] = 0;
    } else {
      let normalizedX = (x - EDGE_PADDING) / (width - 2 * EDGE_PADDING);
      let distanceFromCenter = abs(normalizedX - 0.5);
      let falloff = exp(-distanceFromCenter * distanceFromCenter / 0.03);
      
      // Enhanced animation
      let time = frameCount * 0.02;
      let bassInfluence = map(bass, 0, 255, 0, 20);
      let trebleInfluence = map(treble, 0, 255, 0, 10);
      let animationValue = sin(time + x * 0.01) * 5 + 
                          cos(time * 0.5 + x * 0.02) * bassInfluence +
                          sin(time * 2 + x * 0.03) * trebleInfluence;
      
      newLine[x] = value * falloff + animationValue;
    }
  }
  lines.unshift(newLine);
  
  // Draw lines with enhanced effects
  for (let i = 0; i < lines.length; i++) {
    let alpha = map(i, 0, lines.length, 1, 0.2);
    stroke(currentHue, 80, 80, alpha);
    
    beginShape();
    vertex(0, i * LINE_SPACING + height/3);
    
    for (let x = 0; x < width; x += 3) {
      let y = i * LINE_SPACING + height/3 + lines[i][x];
      let waveOffset = sin(frameCount * 0.05 + i * 0.1) * 2;
      curveVertex(x, y + waveOffset);
    }
    
    vertex(width, i * LINE_SPACING + height/3);
    endShape();
  }
}

function updateUI() {
  if (song.isPlaying()) {
    let progress = song.currentTime() / song.duration();
    select('.progress-fill').style('width', (progress * 100) + '%');
    
    let currentTime = formatTime(song.currentTime());
    let totalTime = formatTime(song.duration());
    select('.time-display').html(`${currentTime} / ${totalTime}`);
    
    // Update visualizer intensity based on volume
    let volumeScale = map(smoothedVolume, 0, 1, 0.5, 2);
    document.documentElement.style.setProperty('--intensity-scale', volumeScale);
  }
}

function formatTime(seconds) {
  let minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function togglePlay() {
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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  lines = [];
  for (let i = 0; i < NUM_LINES; i++) {
    lines[i] = new Array(width).fill(0);
  }
}

// Add modern CSS styles
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
    
    .song-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initializeLines(); // Use the proper initialization function
}

