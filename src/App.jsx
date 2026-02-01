import React, { useEffect, useRef, useState } from 'react';
import SimulatorControls from './components/SimulatorControls';
import { translations as t } from './translations';
import { solveCatenary, calculateWeight, solveSeabedCatenary } from './utils/catenary';
import boatImage from './assets/650_sidovy_1400px.webp';

/**
 * Stegerholmens Småbåtshamn - Simulator v10.4 (Skala 1px = 1cm).
 * Uppdatering: Mass/Inertia physics, heavier boat logic.
 * - Added mass factor based on boat length.
 * - Reduced acceleration speed to simulate heavy weight.
 * - Moved Dock X to accommodate larger boats.
 */

const App = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // State
  const [language, setLanguage] = useState('sv'); 
  
  const [waterLevelCm, setWaterLevelCm] = useState(20); 
  const [seabedDepthCm, setSeabedDepthCm] = useState(200); 
  const [waveHeightCm, setWaveHeightCm] = useState(10); 
  
  const [dockHeightCm, setDockHeightCm] = useState(300); 
  const [isFloatingDock, setIsFloatingDock] = useState(false);

  // --- CONFIGURATION ---
  // Ändra dessa värden för att ställa in default-läget
  const CONFIG = {
      defaultSternTotal: 980, // 15m default for 6.5m boat
      defaultChainPercent: 85
  };

  const calcChain = (total, percent) => Math.round(total * (percent / 100));
  const calcRope = (total, chain) => total - chain;

  const initChain = calcChain(CONFIG.defaultSternTotal, CONFIG.defaultChainPercent);
  const initRope = calcRope(CONFIG.defaultSternTotal, initChain);

  // Förtöjning & Båt
  const [sternTotalLengthCm, setSternTotalLengthCm] = useState(CONFIG.defaultSternTotal);
  const [sternChainPercent, setSternChainPercent] = useState(CONFIG.defaultChainPercent);
  const [sternChainLengthCm, setSternChainLengthCm] = useState(initChain); 
  const [sternRopeLengthCm, setSternRopeLengthCm] = useState(initRope); 
  const [bowRopeLengthCm, setBowRopeLengthCm] = useState(250); 
  const [anchorPositionXCm, setAnchorPositionXCm] = useState(1500); // 25m
  const [boatLengthCm, setBoatLengthCm] = useState(650); // 6.5m
  
  const [windSpeedMs, setWindSpeedMs] = useState(15); 
  const [windDirection, setWindDirection] = useState(1); 
  const [chainThickness, setChainThickness] = useState(10); 
  
  const [weatherMode, setWeatherMode] = useState('OFF');
  const [isSunk, setIsSunk] = useState(false);
  const [isAnchorDragged, setIsAnchorDragged] = useState(false);
  const [dragDistance, setDragDistance] = useState(0);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);

  // Realistic chain weights (kg/m) based on thickness (mm)
  // Using average values where ranges are given
  const CHAIN_WEIGHTS = {
    4: 0.32,
    6: 0.7,    // Average of 0.6-0.8
    8: 1.4,
    10: 1.9,   // Average of 1.75-2.1
    13: 2.98,  // Average of 2.95-3.0
    16: 4.45,
    19: 6.4    // Average of 6.25-6.6
  };
  
  const calculateWeight = (thicknessMm) => {
    // Return exact match if available
    if (CHAIN_WEIGHTS[thicknessMm]) {
      return CHAIN_WEIGHTS[thicknessMm];
    }
    // Interpolate for in-between values
    const sizes = Object.keys(CHAIN_WEIGHTS).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < sizes.length - 1; i++) {
      if (thicknessMm > sizes[i] && thicknessMm < sizes[i + 1]) {
        const ratio = (thicknessMm - sizes[i]) / (sizes[i + 1] - sizes[i]);
        return CHAIN_WEIGHTS[sizes[i]] + ratio * (CHAIN_WEIGHTS[sizes[i + 1]] - CHAIN_WEIGHTS[sizes[i]]);
      }
    }
    // Fallback: extrapolate for values outside range
    if (thicknessMm < sizes[0]) return CHAIN_WEIGHTS[sizes[0]];
    return CHAIN_WEIGHTS[sizes[sizes.length - 1]];
  };
  
  const ROPE_WEIGHT_PER_M = 0.1;

  const txt = t[language];

  // Wave Constants
  const WAVE_SPEED_CM_S = 100; 
  const WAVE_LENGTH_CM = 600;  
  const WAVE_K = (2 * Math.PI) / WAVE_LENGTH_CM; 

  // ============================================================
  // WIND FORCE FACTOR - Adjust this to tune wind effect on boat
  // 1.0 = realistic physics, lower = less effect, higher = more effect
  // ============================================================
  const WIND_FORCE_FACTOR = 2.0; 

  // ============================================================
  // ANCHOR HOLD FORCE - Force in Newtons required to drag anchor
  // If stern tension exceeds this, anchor will drag along seabed
  // Typical holding power: 500-2000N depending on anchor type/bottom
  // ============================================================
  const ANCHOR_HOLD_FORCE = 5000; // Newtons 

  // ============================================================
  // VISUAL WATERLINE FACTOR - Adjust how high the boat floats
  // Does not change floating force, only visual position.
  // Higher value = Boat sits higher (more hull visible)
  // ============================================================
  const BOAT_WATERLINE_CM = 75; 

  // Utökat moln-array för mer variation
  const cloudsRef = useRef([
    { x: 100, y: 50, scale: 0.8, speedFactor: 0.2 },
    { x: 400, y: 80, scale: 1.2, speedFactor: 0.15 },
    { x: 700, y: 40, scale: 0.6, speedFactor: 0.25 },
    { x: 950, y: 100, scale: 1.0, speedFactor: 0.18 },
    { x: 250, y: 60, scale: 0.9, speedFactor: 0.22 },
    { x: 550, y: 30, scale: 0.7, speedFactor: 0.28 },
    { x: 850, y: 70, scale: 1.1, speedFactor: 0.16 },
    { x: 50, y: 90, scale: 0.85, speedFactor: 0.19 }
  ]);

  const refs = useRef({
    waterLevelCm: 0, seabedDepthCm: 100, dockHeightCm: 200, waveHeightCm: 10, 
    sternChainLengthCm: 400, sternRopeLengthCm: 400, bowRopeLengthCm: 120, anchorPositionXCm: 600, 
    boatLengthCm: 500,
    windSpeedMs: 15, windDir: 1, thickness: 10, 
    boatX: 0, sinkingY: 0, isSunk: false, isColliding: false, wavePhase: 0,
    lang: 'sv', isFloatingDock: false,
    debugData: { sternDist: 0, sternMax: 0, frontDist: 0, frontMax: 0 },
    // Anchor dragging state
    anchorCurrentX: 2500,  // Actual anchor position (can move when dragging)
    anchorDragged: false, // True if anchor has moved from set position
    anchorRotation: 0,    // 0 = normal, Math.PI/2 = rotated 90° when dragging
    sternTensionForce: 0,  // Track current stern tension for display
    lastMooringInteraction: Date.now(), // Allow 5s grace period on start
    uiSyncAnchorDragged: false, // Prevent state update loop
    anchorStartPos: 1500 // Track start pos for drag calc
  });

  // Reset interaction timer when mooring parameters change
  useEffect(() => {
      refs.current.uiSyncAnchorDragged = false;
      setIsAnchorDragged(false);
      setDragDistance(0);
      refs.current.lastMooringInteraction = Date.now();
      refs.current.anchorStartPos = anchorPositionXCm; // Update start pos reference
      // Also reset anchor drag state if user manually moves it or changes line
      refs.current.anchorDragged = false;
      // If user moves anchor slider, sync current position immediately
      // (Unless it was dragged? Maybe best to just reset to slider value)
      // Yes, slider controls "Intended" position. If dragged, it drifts.
      // But if user TOUCHES slider, we snap back to slider value.
      if (Math.abs(refs.current.anchorCurrentX - anchorPositionXCm) > 10) {
           refs.current.anchorCurrentX = anchorPositionXCm;
      }
  }, [sternChainLengthCm, sternRopeLengthCm, anchorPositionXCm, boatLengthCm]);

  // Preload boat image
  const boatImgRef = useRef(null);
  useEffect(() => {
    const img = new Image();
    img.src = boatImage;
    img.onload = () => {
      boatImgRef.current = img;
    };
  }, []);

  // Synka refs
  useEffect(() => {
    if (weatherMode === 'OFF') {
        if (refs.current.isSunk) {
             refs.current.isSunk = false;
             refs.current.sinkingY = 0;
             setIsSunk(false);
        }
    }

    // Reset anchor to set position when any mooring setting changes
    const anchorChanged = refs.current.anchorPositionXCm !== anchorPositionXCm;
    const mooringChanged = refs.current.sternChainLengthCm !== sternChainLengthCm || 
                           refs.current.sternRopeLengthCm !== sternRopeLengthCm;
    
    if (anchorChanged || mooringChanged) {
      refs.current.anchorCurrentX = anchorPositionXCm;
      refs.current.anchorDragged = false;
      refs.current.anchorRotation = 0;
    }

    refs.current = {
      ...refs.current,
      waterLevelCm, seabedDepthCm, dockHeightCm, waveHeightCm, 
      sternChainLengthCm: sternChainLengthCm, sternRopeLengthCm: sternRopeLengthCm, bowRopeLengthCm: bowRopeLengthCm, 
      anchorPositionXCm, boatLengthCm,
      windSpeedMs: windSpeedMs, windDir: windDirection, thickness: chainThickness,
      isSunk, isFloatingDock, lang: language
    };
  }, [waterLevelCm, seabedDepthCm, dockHeightCm, waveHeightCm, sternChainLengthCm, sternRopeLengthCm, bowRopeLengthCm, anchorPositionXCm, boatLengthCm, windSpeedMs, windDirection, chainThickness, isSunk, weatherMode, isFloatingDock, language]);

  // Automatiskt Väder Loop
  useEffect(() => {
    let interval;
    if (weatherMode !== 'OFF') {
        let time = 0;

        interval = setInterval(() => {
            time += 0.02; 
            
            let newWater = 0;
            let windVal = 0;
            
            if (weatherMode === 'NORMAL') {
                newWater = Math.round(25 + 55 * Math.sin(time * 0.1));
                windVal = 21 * (Math.sin(time * 0.15) * 0.6 + Math.sin(time * 0.4) * 0.4);
            } else if (weatherMode === 'EXTREME') {
                newWater = Math.round(35 + 135 * Math.sin(time * 0.08));
                windVal = 30 * (Math.sin(time * 0.12) * 0.7 + Math.sin(time * 0.5) * 0.3);
            }

            const absWind = Math.round(Math.abs(windVal));
            setWaterLevelCm(newWater);
            setWindSpeedMs(absWind);
            setWindDirection(windVal >= 0 ? 1 : -1);
            
            setWaveHeightCm(Math.max(5, Math.round(absWind * 2.5)));

            if (refs.current.isSunk) {
                refs.current.isSunk = false;
                refs.current.sinkingY = 0;
                setIsSunk(false);
            }

        }, 50); 
    }
    return () => clearInterval(interval);
  }, [weatherMode]);

  const handleRestart = () => {
    setIsSunk(false);
    setShowRestart(false);
    setWaterLevelCm(20);
    setSeabedDepthCm(250);
    setDockHeightCm(200);
    setWaveHeightCm(10);
    setSternTotalLengthCm(3000);
    setSternChainPercent(CONFIG.defaultChainPercent);
    setSternChainLengthCm(2000);
    setSternRopeLengthCm(1000);
    setChainThickness(10);
    setBowRopeLengthCm(250);
    setAnchorPositionXCm(2500);
    setBoatLengthCm(650);
    
    // Reset Refs logic
    refs.current.boatX = 0;
    refs.current.boatVX = 0;
    refs.current.isSunk = false;
    refs.current.sinkingY = 0;
    refs.current.anchorDragged = false;
    refs.current.anchorRotation = 0;
    refs.current.anchorCurrentX = 2500;
    
    // Ensure these match state
    refs.current.sternChainLengthCm = 2000;
    refs.current.sternRopeLengthCm = 1000;
    setWindSpeedMs(15);
    setWindDirection(1);
    setChainThickness(10);
    setWeatherMode('OFF');
    refs.current.boatX = 0;
    refs.current.sinkingY = 0;
    refs.current.isSunk = false;
  };

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        setDimensions({ width: w, height: h });
        
        // Calculate auto-zoom based on screen size
        // Base design is for 1200px width
        const baseWidth = 1200;
        const autoZoom = Math.min(1.5, Math.max(0.5, w / baseWidth));
        setZoom(autoZoom);
        
        // Check for portrait mode on mobile (width < 768px and height > width)
        const isMobile = w < 768;
        const isPortrait = h > w;
        setShowRotatePrompt(isMobile && isPortrait);
      }
    };
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);
    updateSize();
    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;
    let lastLog = 0;

    const drawBoat = (ctx, x, y, angle, state, currentWind, length) => {
      ctx.save(); 
      ctx.translate(x, y); 
      ctx.rotate(angle);
      
      const img = boatImgRef.current;
      
      if (img) {
        // Image dimensions: 1400px wide, we need to scale to match boat length
        const imgAspect = img.width / img.height;
        const boatWidth = length * 1.15; // Slightly larger to include motor
        const boatHeight = boatWidth / imgAspect;
        
        // Position: center the boat, with waterline roughly at y=0
        const offsetX = -boatWidth / 2;
        const offsetY = -boatHeight * 0.4;
        
        // Check if boat is colliding
        const isColliding = state === 'colliding' || state === 'critical';
        
        if (isColliding) {
          // Use offscreen canvas to create masked red overlay
          const offCanvas = document.createElement('canvas');
          offCanvas.width = Math.ceil(boatWidth);
          offCanvas.height = Math.ceil(boatHeight);
          const offCtx = offCanvas.getContext('2d');
          
          // Draw boat image on offscreen canvas
          offCtx.drawImage(img, 0, 0, boatWidth, boatHeight);
          
          // Use 'source-in' to draw red only where boat pixels exist (respects alpha)
          offCtx.globalCompositeOperation = 'source-in';
          offCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          offCtx.fillRect(0, 0, boatWidth, boatHeight);
          
          // Draw original boat first
          ctx.drawImage(img, offsetX, offsetY, boatWidth, boatHeight);
          
          // Draw the red-masked overlay on top
          ctx.drawImage(offCanvas, offsetX, offsetY);
        } else {
          // Normal boat drawing
          ctx.drawImage(img, offsetX, offsetY, boatWidth, boatHeight);
        }
      } else {
        // Fallback: simple rectangle if image not loaded
        ctx.fillStyle = state === 'colliding' ? '#ef4444' : '#ffffff';
        ctx.fillRect(-length/2, -length * 0.1, length, length * 0.2);
      }
      
      ctx.restore();
    };

    const drawHorizontalRuler = (ctx, seabedY, dockX, pScale = 1.0) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.3)'; ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 1; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';

      // Base line
      ctx.beginPath(); ctx.moveTo(0, seabedY); ctx.lineTo(dimensions.width, seabedY); ctx.stroke();
      
      const pxPerM = 100 * pScale;
      // Step: typically 10cm or 20cm depending on scale. 
      // At scale 0.5, 10cm = 5px. This is fine.
      const stepPx = 10 * pScale; 
      
      // Iterate relative to dockX
      // We start from the left edge of the screen (0)
      // 0 = dockX + offset => offset = -dockX
      const minOffset = -dockX;
      const maxOffset = dimensions.width - dockX;
      
      // Align start to the grid
      const startOffset = Math.ceil(minOffset / stepPx) * stepPx;
      
      for (let offset = startOffset; offset <= maxOffset; offset += stepPx) {
          const x = dockX + offset;
          // Distance in CM (Logical)
          // Positive offset is RIGHT of dock (Negative distance)
          // Negative offset is LEFT of dock (Positive distance)
          const distCm = Math.round(offset / -pScale);
          
          ctx.beginPath();
          
          if (distCm % 100 === 0) {
              // Meter mark
              ctx.moveTo(x, seabedY); ctx.lineTo(x, seabedY + 15); ctx.stroke();
              const label = (distCm / 100).toFixed(0) + 'm'; 
              ctx.fillText(label, x, seabedY + 28);
          } else if (distCm % 50 === 0) {
              // Half meter
              ctx.moveTo(x, seabedY); ctx.lineTo(x, seabedY + 8); ctx.stroke();
          } else {
              // Decimeter (only draw if scale is large enough to see, e.g., > 3px step)
              if (stepPx > 2) {
                  ctx.moveTo(x, seabedY); ctx.lineTo(x, seabedY + 4); ctx.stroke();
              }
          }
      }
      ctx.restore();
    };

    const drawCloud = (ctx, x, y, scale, color) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.arc(15, -10, 25, 0, Math.PI * 2);
      ctx.arc(40, 0, 20, 0, Math.PI * 2); ctx.arc(20, 10, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawSun = (ctx, opacity) => {
      if (opacity <= 0) return;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(dimensions.width - 450, 80);
      const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, 60);
      grad.addColorStop(0, 'rgba(255, 220, 0, 0.5)'); grad.addColorStop(1, 'rgba(255, 220, 0, 0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const drawRain = (ctx, windSpeed, windDir) => {
      if (windSpeed < 10) return; // Regn endast vid hård vind (>10 m/s)
      
      const rainCount = Math.floor(windSpeed * 15); // Mer regn vid högre vind
      const angle = (windDir * Math.PI) / 6; // Lutning på regnet
      const length = 10 + (windSpeed * 0.5); // Längre droppar vid högre fart
      
      ctx.save();
      ctx.strokeStyle = 'rgba(60, 75, 100, 0.8)';
      ctx.lineWidth = 1;
      
      // Använd tid för animation
      const offset = (time * 1000) % dimensions.height;
      
      for (let i = 0; i < rainCount; i++) {
        // Pseudo-slump baserad på index så regnet ser likadant ut varje frame (men rör sig)
        // Vi lägger till time för rörelse
        const xSeed = (i * 1234.5678) % dimensions.width;
        const ySeed = (i * 8765.4321) % dimensions.height;
        
        // Rörelse nedåt och med vinden
        let y = (ySeed + (time * 800)) % dimensions.height;
        let x = (xSeed + (time * windSpeed * windDir * 50)) % dimensions.width;
        if (x < 0) x += dimensions.width;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.sin(angle) * length, y + Math.cos(angle) * length);
        ctx.stroke();
      }
      ctx.restore();
    };

    const animate = () => {
      // GLOBAL SCALE: 0.5px = 1cm
      const P_SCALE = 0.5; 

      time += 0.02;
      const r = refs.current;
      const chainW = calculateWeight(r.thickness);
      const totStern = r.sternChainLengthCm + r.sternRopeLengthCm;
      const effectiveSagWeight = totStern > 0 ? ((chainW * r.sternChainLengthCm) + (ROPE_WEIGHT_PER_M * r.sternRopeLengthCm)) / totStern : chainW;
      
      const waveVar = 1 + 0.2 * Math.sin(time * 0.7); 
      const currentAmp = r.waveHeightCm * waveVar * P_SCALE;

      const phaseSpeed = (WAVE_SPEED_CM_S / 60) * WAVE_K * r.windDir; 
      r.wavePhase -= phaseSpeed; 

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      
      // FILL ENTIRE CANVAS with a neutral background first (prevents any gaps)
      ctx.fillStyle = '#64748b'; // Slate-500 - matches rock color
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      
      // Pre-calculate base positions for background fill (before zoom)
      const b0Y_base = dimensions.height * 0.6;
      const seaY_base = b0Y_base + (r.seabedDepthCm * P_SCALE);
      
      // Fill entire canvas with base colors BEFORE zoom (prevents edge gaps)
      // Sky - fill entire top portion
      const windFactorBase = Math.min(1, Math.abs(r.windSpeedMs) / 20);
      const sFactorBase = windFactorBase * 0.8;
      ctx.fillStyle = `rgb(${Math.round(186 + (17 * sFactorBase))},${Math.round(230 - (17 * sFactorBase))},${Math.round(253 - (28 * sFactorBase))})`;
      ctx.fillRect(0, 0, dimensions.width, b0Y_base);
      
      // Water base color - from horizon to bottom
      ctx.fillStyle = 'rgba(14, 165, 233, 0.85)';
      ctx.fillRect(0, b0Y_base - 20, dimensions.width, dimensions.height);
      
      // Apply zoom transform (scale from center)
      ctx.save();
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      ctx.translate(centerX, centerY);
      ctx.scale(zoom, zoom);
      ctx.translate(-centerX, -centerY);

      // Simulate Wind with Gusts: Base + Low Freq Gusts + High Freq Noise
      const baseWind = r.windSpeedMs;
      const gustLow = Math.sin(time * 0.2) * 0.3; // Slow swelling +/- 30%
      const gustHigh = Math.sin(time * 1.5) * 0.1; // Faster jitter +/- 10%
      // Ensure we don't drop below 20% of base ever
      // Use 1.0 ensure base wind is respected as center
      const windMod = Math.max(0.2, 1.0 + gustLow + gustHigh); 
      const currentWind = baseWind * windMod * r.windDir;

      // --- VÄDERGRAFIK BERÄKNING ---
      // Vindfaktor 0 (stiltje) till 1 (storm 20+ m/s)
      const windFactor = Math.min(1, Math.abs(r.windSpeedMs) / 20); 
      
      // Himmelsfärg: Vitare/Gråare vid vind (Overcast)
      // Sky-200: 186, 230, 253 -> Slate-300: 203, 213, 225
      const sFactor = windFactor * 0.8; 
      const rSky = 186 + ((203 - 186) * sFactor);
      const gSky = 230 + ((213 - 230) * sFactor);
      const bSky = 253 + ((225 - 253) * sFactor);
      
      // Calculate visible viewport bounds accounting for zoom
      // When zoomed out (zoom < 1), we can see more area
      const viewportExtend = 1 / zoom; // How much larger the visible area is
      const extendedWidth = dimensions.width * viewportExtend;
      const extendedHeight = dimensions.height * viewportExtend;
      const viewOffsetX = (extendedWidth - dimensions.width) / 2;
      const viewOffsetY = (extendedHeight - dimensions.height) / 2;
      
      ctx.fillStyle = `rgb(${Math.round(rSky)},${Math.round(gSky)},${Math.round(bSky)})`;
      // Fill extended area to account for zoom
      ctx.fillRect(-viewOffsetX, -viewOffsetY, extendedWidth, extendedHeight);
      
      const b0Y = dimensions.height * 0.6; 
      // SCALE FACTOR: 0.5px = 1cm (Doubles the field of view in meters)
      // P_SCALE is already defined at top of animate() 
      
      const curY = b0Y - (r.waterLevelCm * P_SCALE);
      const seaY = b0Y + (r.seabedDepthCm * P_SCALE); 
      
      let catenaryPoints = null; 
      let bowCatenaryPoints = null; 
      
      // Dynamisk bryggposition för att hantera stora båtar
      // Bryggan flyttas så att den alltid är "framför" båten vid start
      const dockX = (dimensions.width / 2) + Math.max(200, (r.boatLengthCm * 0.7 * P_SCALE)); 
      // Anchor position uses anchorCurrentX (CM) -> Scaled to Pixels
      const anchorX = dockX - (r.anchorCurrentX * P_SCALE);


      let dockY;
      if (r.isFloatingDock) {
        // Wave offset calculated on CM coordinates or Screen? 
        // WAVE_K is usually small. Visual effect primarily.
        // Let's use dockX (screen) for wave phase, it's fine.
        const dockWaveOffset = Math.sin(dockX * WAVE_K + r.wavePhase) * currentAmp;
        dockY = curY + dockWaveOffset - 15; 
      } else {
        // Fixed Dock: Height measured from seabed (seaY)
        dockY = seaY - (r.dockHeightCm * P_SCALE); 
      }
      
      // Pass P_SCALE to refs for access in event handlers if needed
      // (Or just use it in draw loops)


      // Solen (försvinner vid vind > 15-20)
      const sunOpacity = Math.max(0, 1 - (windFactor * 1.2));
      drawSun(ctx, sunOpacity);

      // Moln (Fler och mörkare vid vind)
      const cloudColorVal = 255 - (100 * windFactor); // Vit -> Grå
      const cloudColor = `rgba(${cloudColorVal}, ${cloudColorVal}, ${cloudColorVal}, 0.8)`;
      
      // Visa fler moln baserat på vind (index 0-3 alltid, 4-7 vid mer vind)
      const visibleClouds = 3 + Math.floor(windFactor * 5); 
      
      cloudsRef.current.forEach((c, idx) => {
        if (idx < visibleClouds) {
            c.x += currentWind * c.speedFactor;
            if (c.x > dimensions.width + 100) c.x = -100;
            if (c.x < -100) c.x = dimensions.width + 100;
            drawCloud(ctx, c.x, c.y, c.scale, cloudColor);
        }
      });

      // Draw Landscape (Procedural Rocks + Huts) - pass dockX for hut positioning
      drawLandscape(ctx, dimensions.width, seaY, currentWind, time, viewOffsetX, dockX);

      drawRain(ctx, Math.abs(r.windSpeedMs), r.windDir);

      // --- LOGIK ---
      // --- LOGIK ---
      // --- VARIABLES DECLARED TOP SCOPE FOR DEBUG ACCESS ---
      let forceX = 0;
      let sternTensionX = 0;
      let bowTensionX = 0;
      let windForce = 0;
      let boatXAbs, boatFinalY, totalAngle, bState;
      let sternAttachX, sternAttachY, bowAttachX, bowAttachY;
      let sTaut, fTaut, fCritical;
      let distS = 0, distF = 0;

      // Scale Boat Dimensions for Screen Positioning (Attach points must match visual scale)
      // Scale Boat Dimensions for Screen Positioning (Attach points must match visual scale)
      const halfL = (r.boatLengthCm * P_SCALE) / 2;
      const boatHeight = (r.boatLengthCm * P_SCALE) * 0.25; 
      
      // Attachment point offsets (Screen Pixels)
      const sternAttachOffsetX = -halfL * 0.85; 
      const sternAttachOffsetY = -boatHeight * 0.20; // Was 0.15, lifted 30%
      
      const bowAttachOffsetX = halfL * 0.9; 
      const bowAttachOffsetY = -boatHeight * 0.33; // Was 0.25, lifted 30%
      
      const deckHeightOffset = boatHeight * 0.52; // Was 0.4, lifted 30%

      // -----------------------------------------------------------------------



      const maxSternReach = r.sternChainLengthCm + r.sternRopeLengthCm; // CM
      const maxSternStretch = maxSternReach * 1.03; // CM
      const maxFrontStretch = r.bowRopeLengthCm * 1.10; // CM

      if (r.isSunk) {
        r.sinkingY += 0.5 * P_SCALE; // Sinking speed scaled visually
        boatXAbs = (dimensions.width / 2) + (r.boatX * P_SCALE);
        let maxSinkY = seaY - (halfL * 0.6); 
        let currentSinkY = (curY + r.sinkingY);
        if (currentSinkY >= maxSinkY) currentSinkY = maxSinkY;
        boatFinalY = currentSinkY;
        totalAngle = Math.PI / 12;
        bState = 'sunk';
        const cosA = Math.cos(totalAngle); const sinA = Math.sin(totalAngle);
        
        sternAttachX = boatXAbs + (sternAttachOffsetX * cosA - sternAttachOffsetY * sinA);
        sternAttachY = boatFinalY + (sternAttachOffsetX * sinA + sternAttachOffsetY * cosA);
        bowAttachX = boatXAbs + (bowAttachOffsetX * cosA - bowAttachOffsetY * sinA);
        bowAttachY = boatFinalY + (bowAttachOffsetX * sinA + bowAttachOffsetY * cosA);
        
        sTaut = false; fTaut = true; fCritical = true;
        
        // Distances in CM for Debug
        distS = Math.sqrt(Math.pow(sternAttachX - anchorX, 2) + Math.pow(sternAttachY - seaY, 2)) / P_SCALE;
        distF = Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2)) / P_SCALE;
      } else {
        // --- PHYSICS UPDATE ---
        const mass = 800 + (r.boatLengthCm - 300) * 4;

        // 2. Wind Force 
        const projectedArea = 2.0 * (r.boatLengthCm / 500); 
        const airRho = 1.225;
        const vWind = Math.abs(currentWind);
        const windForceMag = 0.5 * airRho * projectedArea * (vWind * vWind);
        windForce = Math.sign(currentWind) * windForceMag * WIND_FORCE_FACTOR;
        
        if (typeof r.boatVX === 'undefined' || isNaN(r.boatVX)) r.boatVX = 0;

        forceX = windForce; 
        var chainForceVal = 0;
        var ropeForceVal = 0;
        
        // 3. Water Drag 
        // Note: r.boatVX is in CM/Frame. 
        // drag formulas usually expect m/s. But coefficients here are arbitrary/tuned.
        // We keep physics units (CM/Frame) as is.
        const submergedArea = (r.boatLengthCm / 100) * 0.5; 
        const waterRho = 1000;
        const Cd_Water = 1.0; 
        
        const vBoat = Math.abs(r.boatVX);
        // Drag calculation unchanged
        const dragMag = 0.5 * waterRho * Cd_Water * submergedArea * (vBoat * vBoat);
        const dragForce = -Math.sign(r.boatVX) * dragMag;
        const viscousDrag = -r.boatVX * 50.0;
        
        forceX += (dragForce + viscousDrag); 

        // 3. Chain Drag 
        const currentBoatXAbs = (dimensions.width / 2) + (r.boatX * P_SCALE);
        
        const currentSternX = currentBoatXAbs + sternAttachOffsetX;
        const currentBowX = currentBoatXAbs + bowAttachOffsetX;
        
        // Screen Pixels
        const physDxS = Math.abs(currentSternX - anchorX);
        const boatElevBox = seaY - (curY - deckHeightOffset);
        
        // Convert to CM for Physics
        const physDxS_CM = physDxS / P_SCALE;
        const boatElev_CM = boatElevBox / P_SCALE;

        if (maxSternReach > 0) {
            const totStern = r.sternChainLengthCm + r.sternRopeLengthCm;
            const chainW = calculateWeight(r.thickness); 
            const ropeW = ROPE_WEIGHT_PER_M;
            
            const linearDist_CM = Math.sqrt(physDxS_CM*physDxS_CM + boatElev_CM*boatElev_CM);
            let liftedChainAmount = 0;
            
            let w = ropeW;
            if (linearDist_CM > r.sternRopeLengthCm) {
                    liftedChainAmount = Math.max(0, Math.min(r.sternChainLengthCm, linearDist_CM - r.sternRopeLengthCm));
                    const liftedRope = r.sternRopeLengthCm;
                    const totalLifted = liftedChainAmount + liftedRope;
                    w = ((liftedChainAmount * chainW) + (liftedRope * ropeW)) / totalLifted;
            } else {
                if (r.sternRopeLengthCm <= 1) w = chainW;
            }
            
            const anchorElev = 0;
            // Use Seabed Solver to handle slack chain correctly (stops points going deeply underground)
            const result = solveSeabedCatenary(0, boatElev_CM, physDxS_CM, anchorElev, maxSternReach);
            
            if (result.isStraight) {
                const dist = Math.sqrt(physDxS_CM*physDxS_CM + boatElev_CM*boatElev_CM);
                const angle = Math.atan2(boatElev_CM, physDxS_CM); 

                // Linear Spring Model for Taut Line to prevent 1M+ Newton spikes
                const stiffnessK = 500.0; // N per cm stretch
                const baseTension = 1000.0; // Tension at exact length limit

                let tensionForce;
                if (dist >= maxSternReach) {
                    const stretch = dist - maxSternReach;
                    tensionForce = baseTension + (stretch * stiffnessK);
                } else {
                    // Transition zone (highly stretched but not broken)
                    const ratio = dist / maxSternReach;
                    tensionForce = baseTension * Math.pow(ratio, 10); // Steep curve up to base
                }
                sternTensionX = tensionForce * Math.cos(angle);
                catenaryPoints = result.drawPoints;
            } else {
                let H;
                if (result.tensionX !== undefined) {
                    // Explicit tension passed (e.g. 0 for slack chain)
                    H = result.tensionX;
                } else {
                    H = Math.abs(result.a * w); 
                }
                sternTensionX = H;

                const isChainLifted = liftedChainAmount > 5;
                chainForceVal = isChainLifted ? sternTensionX : 0;
                ropeForceVal = sternTensionX;
                
                catenaryPoints = result.drawPoints;

                if (result.a < 500) {
                        forceX -= r.boatVX * (chainW * 5.0);
                }
            }
        }

        // Anchor Logic
        r.sternTensionForce = sternTensionX;
        
        // Allow 5 seconds grace period after any mooring change before anchor can drag
        const isSettling = (Date.now() - r.lastMooringInteraction) < 5000;
        
        if (sternTensionX > ANCHOR_HOLD_FORCE && maxSternReach > 0 && !isSettling) {
            if (!r.anchorDragged) {
                 console.log(`Anchor dragged at ${sternTensionX.toFixed(2)} Newton`);
            }
            r.anchorDragged = true;
            r.anchorRotation = Math.PI / 2; 
            
            // Constant drag speed: 1.0 cm per second (assuming 60 fps)
            const dragSpeed = 10 / 60.0; 
            
            // Update anchor position (CM)
            r.anchorCurrentX = Math.max(100, r.anchorCurrentX - dragSpeed);

            // Sync with UI State (throttled)
            if (!r.uiSyncAnchorDragged) {
                 r.uiSyncAnchorDragged = true;
                 setIsAnchorDragged(true);
            }
            
            // Sync drag distance
            const dist = Math.round(Math.abs(r.anchorCurrentX - r.anchorStartPos));
            if (Math.abs(dist - (r.lastSyncedDragDist || 0)) > 5) {
                 r.lastSyncedDragDist = dist;
                 setDragDistance(dist);
            }
        } else if (r.anchorDragged) {
            r.anchorRotation *= 0.95; 
            if (r.anchorRotation < 0.1) r.anchorRotation = 0;
        }

        // 4. Bow Tension
        const currentBowY = curY - deckHeightOffset;
        const physDxF = currentBowX - dockX; 
        const physDyF = currentBowY - dockY;
        const distF_Screen = Math.sqrt(physDxF*physDxF + physDyF*physDyF);
        const distF_CM = distF_Screen / P_SCALE;

        if (r.bowRopeLengthCm > 0) {
                const maxBowReach = r.bowRopeLengthCm;
                
                if (distF_CM > maxBowReach) {
                    const stretch = distF_CM - maxBowReach;
                    const k = 100.0; 
                    const baseTension = 2000.0; 
                    const T = baseTension + (stretch * k);
                    
                    const angleToDock = Math.atan2(-physDyF, -physDxF);
                    bowTensionX = Math.abs(T * Math.cos(angleToDock));
                    
                    if (Math.abs(r.boatVX) > 0.01) {
                        const damping = r.boatVX * 150.0;
                        forceX -= damping;
                    }
                } else {
                    bowTensionX = 0;
                }
        }

        const sternForceSign = currentSternX > anchorX ? -1 : 1;
        const bowForceSign = currentBowX < dockX ? 1 : -1;
        
        if (bowTensionX > 100) forceX -= (r.boatVX * 100); 

        forceX += (sternTensionX * sternForceSign);
        forceX += (bowTensionX * bowForceSign);

        const accelX = forceX / mass;
        r.boatVX += accelX * 0.05; 
        r.boatVX *= 0.98; 
        
        if (isNaN(r.boatVX)) { r.boatVX = 0; }
        r.boatX += r.boatVX;
        if (isNaN(r.boatX)) { r.boatX = 0; }
        
        if (Math.abs(r.boatVX) < 0.01 && Math.abs(forceX) < 1.0) r.boatVX = 0;

        let tempBoatXAbs = (dimensions.width / 2) + (r.boatX * P_SCALE);
        let natY = curY + Math.sin(tempBoatXAbs * WAVE_K + r.wavePhase) * currentAmp;
        
        // Clamping logic (Physics Bounds in Screen Px)
        const attachY = natY - deckHeightOffset;
        const dyF = Math.abs(attachY - dockY);
        const dyS = Math.abs(attachY - seaY);

        let allowedDxFront = 0;
        // Convert to CM, check bound, convert back to Px
        if (dyF / P_SCALE < maxFrontStretch) {
            const dyF_CM = dyF / P_SCALE;
            const allowed_CM = Math.sqrt(Math.pow(maxFrontStretch, 2) - Math.pow(dyF_CM, 2));
            allowedDxFront = allowed_CM * P_SCALE;
        }
        
        let allowedDxStern = 0;
        if (dyS / P_SCALE < maxSternStretch) {
             const dyS_CM = dyS / P_SCALE;
             const allowed_CM = Math.sqrt(Math.pow(maxSternStretch, 2) - Math.pow(dyS_CM, 2));
             allowedDxStern = allowed_CM * P_SCALE;
        }

        const minX_Front = dockX - allowedDxFront - halfL; 
        const maxX_Front = dockX + allowedDxFront - halfL;
        const minX_Stern = anchorX - allowedDxStern + halfL;
        const maxX_Stern = anchorX + allowedDxStern + halfL;

        // --- CONSOLE DEBUG LOGGER (Every 5s) ---
        const now = Date.now();
        if (now - lastLog > 5000) {
            console.log("--- PHYSICS DEBUG ---");
            console.table({
                BoatX_CM: r.boatX.toFixed(1),
                BoatVX: r.boatVX.toFixed(3),
                TotalForce: forceX.toFixed(0),
                DistF_CM: distF_CM.toFixed(1),
                SternTension: sternTensionX.toFixed(0),
            });
            lastLog = now;
        }

        const finalMinX = Math.max(minX_Front, minX_Stern);
        const finalMaxX = Math.min(maxX_Front, maxX_Stern);
        const collisionX = dockX - halfL;
        const safeMaxX = Math.min(finalMaxX, collisionX);

        if (finalMinX > safeMaxX) {
            tempBoatXAbs = (finalMinX + safeMaxX) / 2;
        } else {
            if (tempBoatXAbs < finalMinX) tempBoatXAbs = finalMinX;
            if (tempBoatXAbs > safeMaxX) tempBoatXAbs = safeMaxX;
        }

        boatXAbs = tempBoatXAbs;
        // Update Physics CM Position based on Clamped Screen Position
        r.boatX = (boatXAbs - (dimensions.width / 2)) / P_SCALE;
        
        natY = curY + Math.sin(boatXAbs * WAVE_K + r.wavePhase) * currentAmp;
        const nextY = curY + Math.sin((boatXAbs + (1 * P_SCALE)) * WAVE_K + r.wavePhase) * currentAmp;
        const waveAngle = Math.atan2(nextY - natY, 1 * P_SCALE);

        let tiltAngle = 0;
        // Check hang angle using Scaled Pixels
        if (dyF / P_SCALE > maxFrontStretch) {
             // Calculate hangY in Pixels
             const hangY = dockY + ((maxFrontStretch * P_SCALE) + deckHeightOffset); 
             tiltAngle = Math.atan2(hangY - natY, halfL); // halfL is Scaled, y diff is Scaled -> Angle correct
        }

        totalAngle = waveAngle + tiltAngle;
        
        if (r.boatLengthCm > 300) {
            totalAngle *= 0.5; 
        }

        // --- GEOMETRIC SOLVER ---
        const sxLocal = sternAttachOffsetX; 
        const syLocal = sternAttachOffsetY;
        const fxLocal = bowAttachOffsetX; 
        const fyLocal = bowAttachOffsetY;
        
        const keelOffset = r.boatLengthCm * 0.15 * P_SCALE; 
        const groundLimitY = seaY - keelOffset;    
        
        // Estimate bow/stern X positions for wave calculation (using offset)
        const estBowX = boatXAbs + bowAttachOffsetX;
        const estSternX = boatXAbs + sternAttachOffsetX;
        
        const bowNatY = curY + Math.sin(estBowX * WAVE_K + r.wavePhase) * currentAmp;
        const sternNatY = curY + Math.sin(estSternX * WAVE_K + r.wavePhase) * currentAmp;
        
        let newBowY = bowNatY;
        if (newBowY > groundLimitY) newBowY = groundLimitY;
        
        const dxF = Math.abs(estBowX - dockX);
        const maxRopeF = r.bowRopeLengthCm * 1.05 * P_SCALE; 
        if (dxF < maxRopeF) {
            const maxDyF = Math.sqrt(Math.pow(maxRopeF, 2) - Math.pow(dxF, 2));
            const ropeLimitBottom = dockY + maxDyF + deckHeightOffset; 
            const ropeLimitTop = dockY - maxDyF + deckHeightOffset;
            if (newBowY > ropeLimitBottom) newBowY = ropeLimitBottom;
            if (newBowY < ropeLimitTop) newBowY = ropeLimitTop;
        }

        let newSternY = sternNatY;
        if (newSternY > groundLimitY) newSternY = groundLimitY;
        
        const dxS = Math.abs(estSternX - anchorX);
        const maxRopeS = r.sternChainLengthCm + r.sternRopeLengthCm; 
        if (dxS < maxRopeS) {
             const maxDyS = Math.sqrt(Math.pow(maxRopeS, 2) - Math.pow(dxS, 2));
             const anchorLimitBottom = seaY + maxDyS + deckHeightOffset;
             const anchorLimitTop = seaY - maxDyS + deckHeightOffset;
             
             if (newSternY > anchorLimitBottom) newSternY = anchorLimitBottom;
             if (newSternY < anchorLimitTop) newSternY = anchorLimitTop;
        }
        
        const dy = newSternY - newBowY;
        const sinAngle = dy / r.boatLengthCm;
        const clampedSin = Math.max(-0.9, Math.min(0.9, sinAngle)); 
        totalAngle = Math.asin(clampedSin);
        
        boatFinalY = (newBowY + newSternY) / 2;

        if (Math.abs(totalAngle) > 0.5) totalAngle *= 0.8;
                
        const cosA = Math.cos(totalAngle); const sinA = Math.sin(totalAngle);
        
        sternAttachX = boatXAbs + (sxLocal * cosA - syLocal * sinA);
        sternAttachY = boatFinalY + (sxLocal * sinA + syLocal * cosA);
        bowAttachX = boatXAbs + (fxLocal * cosA - fyLocal * sinA);
        bowAttachY = boatFinalY + (fxLocal * sinA + fyLocal * cosA);
        
        // Recalculate Catenary for Rendering (Visual Sync)
        // Recalculate Catenary for Rendering (Visual Sync)
        const physDxS_Render = Math.abs(sternAttachX - anchorX);
        const sternElev = seaY - sternAttachY; 
        
        const physDxS_CM_Render = physDxS_Render / P_SCALE;
        const sternElev_CM = sternElev / P_SCALE;
        
        const anchorElev = 0;
        if (maxRopeS > 0) {
             // Correctly use Seabed solver and CM units
             const result = solveSeabedCatenary(0, sternElev_CM, physDxS_CM_Render, anchorElev, maxRopeS);
             catenaryPoints = result.drawPoints;
        }



        distS = Math.sqrt(Math.pow(sternAttachX - anchorX, 2) + Math.pow(sternAttachY - seaY, 2));
        distF = Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2));
        
        sTaut = distS >= maxSternStretch - 1;
        fTaut = distF >= r.bowRopeLengthCm; 
        fCritical = distF >= maxFrontStretch - 0.5; 
        const isColl = boatXAbs + halfL >= dockX - 1;

        bState = 'normal';
        const forcedDepth = boatFinalY - curY; 
        if ((newBowY > bowNatY + 5) || (newSternY > sternNatY + 5)) { 
             r.isSunk = true; bState = 'sunk';
        }
        else if (fCritical && r.windDir === 1) bState = 'critical';
        else if (isColl) bState = 'colliding'; 
        else {
             const sternRatio = distS / maxSternStretch;
             const sTautReal = sternRatio > 0.98;
             const fTautReal = (distF / r.bowRopeLengthCm) > 0.98;

             if ((sTautReal && r.windDir === -1) || (fTautReal && sTautReal)) {
                 bState = 'stressed';
             }
        }

        r.isColliding = isColl;
        r.isColliding = isColl;
      }
      
      // Update Debug Data (Always)
      r.debugData = { 
            sternDist: distS, 
            sternMax: maxSternStretch, 
            sternTension: sternTensionX,
            frontDist: distF, 
            frontMax: maxFrontStretch,
            frontTension: bowTensionX,

            windForce: windForce,
            totalForce: forceX,
            chainForce: chainForceVal,
            ropeForce: ropeForceVal
      };

      // --- RENDERING CONFIGURATION (Z-Index Layers) ---
      // --- RENDERING CONFIGURATION (Z-Index Layers) ---
      const backgroundLayer = [
          { id: 'sky', draw: () => {
              // Procedural Sky
              const skyGrad = ctx.createLinearGradient(0, 0, 0, seaY);
              skyGrad.addColorStop(0, '#bae6fd'); skyGrad.addColorStop(1, '#e0f2fe');
              ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, dimensions.width, seaY);
              
              // Clouds (Dynamic)
              const cloudColorVal = 255 - (100 * windFactor); 
              const cloudColor = `rgba(${cloudColorVal}, ${cloudColorVal}, ${cloudColorVal}, 0.8)`;
              cloudsRef.current.forEach((c, idx) => {
                  if (idx < visibleClouds) drawCloud(ctx, c.x, c.y, c.scale, cloudColor);
              });
          }},
          { id: 'sun', draw: () => {
              // Sun (Dynamic)
              const sunOpacity = Math.max(0, 1 - (windFactor * 1.2));
              drawSun(ctx, sunOpacity);
          }},
          { id: 'landscape', draw: () => {
              drawLandscape(ctx, dimensions.width, seaY, currentWind, time);
          }},
          { id: 'rain', draw: () => {
              if (r.weatherMode === 'EXTREME' || r.windSpeedMs > 15) {
                 drawRain(ctx, Math.abs(r.windSpeedMs), r.windDir);
              }
          }}
      ];

      const midLayer = [

          { id: 'dock_pillars', draw: () => {
              if (!r.isFloatingDock) {
                ctx.fillStyle = '#18181b'; 
                ctx.fillRect(dockX + 20, dockY, 12, Math.max(0, seaY - dockY));
                ctx.fillRect(dockX + 110, dockY, 12, Math.max(0, seaY - dockY));
              }
          }},

      ];

      const foregroundLayer = [
          { id: 'water_back', draw: () => {
              const wA = 0.7; ctx.fillStyle = `rgba(14, 165, 233, ${wA})`;
              // Use large bounds to cover any zoom level (-2000 to +4000)
              [30, -20].forEach((o, idx) => {
                ctx.beginPath(); ctx.moveTo(-2000, dimensions.height + 1000);
                for (let i = -2000; i <= dimensions.width + 2000; i += 5) ctx.lineTo(i, curY + o + Math.sin(i * WAVE_K + r.wavePhase + idx) * (currentAmp * 0.7));
                ctx.lineTo(dimensions.width + 2000, dimensions.height + 1000); ctx.fill();
              });
          }},
          { id: 'seabed', draw: () => {
              const seabedGrad = ctx.createLinearGradient(0, seaY, 0, dimensions.height + 1000);
              seabedGrad.addColorStop(0, '#eab308'); seabedGrad.addColorStop(1, '#a16207');
              ctx.fillStyle = seabedGrad; ctx.fillRect(-2000, seaY, dimensions.width + 4000, dimensions.height + 1000);
          }},
          { id: 'anchor', draw: () => {
              ctx.save();
              ctx.translate(anchorX, seaY);
              // Apply rotation when anchor is being dragged
              ctx.rotate(r.anchorRotation || 0);
              ctx.scale(2.5, 2.5); 
              // Red color when anchor has been dragged from original position
              ctx.strokeStyle = r.anchorDragged ? '#ef4444' : '#334155'; 
              ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; 
              ctx.beginPath();
              ctx.moveTo(0, -10); ctx.lineTo(0, 10); 
              ctx.moveTo(-7, 5); ctx.quadraticCurveTo(0, 12, 7, 5); 
              ctx.moveTo(-4, -6); ctx.lineTo(4, -6); 
              ctx.stroke();
              ctx.beginPath(); ctx.arc(0, -12, 3, 0, Math.PI * 2); ctx.stroke(); 
              ctx.restore();
          }},
          { id: 'stern_line', draw: () => {
               if (catenaryPoints && catenaryPoints.length > 1) {
                    // RECALCULATE ATTACH POINT TO ENSURE SYNC WITH RENDER
                    const bX = (dimensions.width / 2) + (r.boatX * P_SCALE);
                    const halfL = (r.boatLengthCm * P_SCALE) / 2;
                    const boatH = (r.boatLengthCm * P_SCALE) * 0.25;
                    const sOffX = -halfL * 0.85; 
                    const sOffY = -boatH * 0.20; // Was 0.15, Sync with physics adjustment
                    const cosA = Math.cos(r.boatAngle || 0);
                    const sinA = Math.sin(r.boatAngle || 0);
                    
                    const sternX = bX + (sOffX * cosA) - (sOffY * sinA);
                    const ancX = dockX - (r.anchorCurrentX * P_SCALE);
                    
                    const sternLeft = sternX < ancX;
                    const chainLen = r.sternChainLengthCm;
                    
                    // Draw Rope (Boat side)
                    ctx.beginPath(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3;

                    let drawnRope = false;
                    const getPt = (p) => {
                         // p is in CM, convert to Scaled Pixels
                         const sx = sternLeft ? (sternX + (p.x * P_SCALE)) : (sternX - (p.x * P_SCALE));
                         const sy = Math.min(seaY, seaY - (p.y * P_SCALE));
                         return {x: sx, y: sy};
                    };

                    let len = 0;
                    let pStart = getPt(catenaryPoints[0]);
                    ctx.moveTo(pStart.x, pStart.y);
                    
                    for(let i=0; i<catenaryPoints.length-1; i++) {
                         const p1 = catenaryPoints[i];
                         const p2 = catenaryPoints[i+1];
                         const segLen = Math.sqrt(Math.pow(p2.x-p1.x, 2) + Math.pow(p2.y-p1.y, 2));
                         if (len < r.sternRopeLengthCm) {
                             const s2 = getPt(p2);
                             ctx.lineTo(s2.x, s2.y);
                             drawnRope = true;
                         } 
                         len += segLen;
                    }
                    if (drawnRope) ctx.stroke();


                    
                    // Draw Chain part (Links)
                    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5; 
                    len = 0;
                    for(let i=0; i<catenaryPoints.length-1; i++) {
                         const p1 = catenaryPoints[i];
                         const p2 = catenaryPoints[i+1];
                         const segLen = Math.sqrt(Math.pow(p2.x-p1.x, 2) + Math.pow(p2.y-p1.y, 2));
                         
                         // If this segment is part of the chain (past rope end), or overlaps it
                         if (len + segLen > r.sternRopeLengthCm) {
                              const s1 = getPt(p1);
                              const s2 = getPt(p2);
                              const linkDist = 10 * P_SCALE;  // Scale link distribution distance
                              const dist = Math.hypot(s2.x - s1.x, s2.y - s1.y);
                              const steps = Math.max(1, Math.floor(dist / linkDist));
                              const angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);

                              for(let k=0; k<steps; k++) {
                                  const t = k/steps;
                                  const currentDistOnLine = len + (segLen * t);
                                  // Only draw if we are significantly past the rope (allow slight overlap)
                                  if (currentDistOnLine > r.sternRopeLengthCm - 10) {
                                      const lx = s1.x + (s2.x - s1.x)*t;
                                      const ly = s1.y + (s2.y - s1.y)*t;
                                      
                                      // Scale link size based on chain thickness
                                      const linkScale = (r.thickness / 10) * P_SCALE * 1.5; 
                                      const linkWidth = 10 * linkScale; 
                                      const linkHeight = 6 * linkScale;
                                      
                                      ctx.save();
                                      ctx.translate(lx, ly);
                                      ctx.rotate(angle);
                                      ctx.beginPath();
                                      ctx.ellipse(0, 0, linkWidth, linkHeight, 0, 0, Math.PI*2);
                                      ctx.stroke();
                                      ctx.restore();
                                  }
                              }
                         }
                         len += segLen;
                    }
               }
          }},
          { id: 'dock_surface', draw: () => {
               ctx.fillStyle = '#451a03'; ctx.fillRect(dockX, dockY - 15, 150, 25);
          }},
          { id: 'bow_rope', draw: () => {
              ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bowAttachX, bowAttachY);
              const dF_draw = Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2));
              // Compare scaled draw distance with scaled rope length
              const slackF = Math.max(0, (r.bowRopeLengthCm * P_SCALE) - dF_draw);
              if (fTaut && r.windDir === 1 && !r.isSunk) {
                ctx.strokeStyle = fCritical ? '#ef4444' : '#f97316'; ctx.lineTo(dockX, dockY); 
              } else {
                ctx.strokeStyle = '#fbbf24';
                const midXF = (bowAttachX + dockX) / 2;
                const midYF = ((bowAttachY + dockY) / 2) + (slackF * 0.5);
                ctx.quadraticCurveTo(midXF, midYF, dockX, dockY);
              }
              ctx.stroke();
          }},

          { id: 'boat', draw: () => {
              // Visual offset
              drawBoat(ctx, boatXAbs, boatFinalY - (BOAT_WATERLINE_CM * P_SCALE), totalAngle, bState, currentWind, r.boatLengthCm * P_SCALE);
          }},
          { id: 'water_front', draw: () => {
              // Use large bounds to cover any zoom level
              const wA = 0.5; ctx.beginPath(); ctx.moveTo(-2000, dimensions.height + 1000);
              for (let i = -2000; i <= dimensions.width + 2000; i += 5) ctx.lineTo(i, curY + Math.sin(i * WAVE_K + r.wavePhase) * currentAmp);
              ctx.lineTo(dimensions.width + 2000, dimensions.height + 1000); ctx.fillStyle = `rgba(14, 165, 233, ${wA})`; ctx.fill();
          }},
          { id: 'depth_ruler', draw: () => {
              // Use P_SCALE for ticks
              // Fix ruler to left edge of screen (account for zoom offset)
              const leftEdge = -viewOffsetX;
              
              ctx.save(); ctx.strokeStyle = 'rgba(15, 23, 42, 0.2)'; ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'; ctx.font = 'bold 14px monospace';
              for (let y = seaY; y > 0; y -= (100 * P_SCALE)) { 
                  ctx.beginPath(); ctx.moveTo(leftEdge + 40, y); ctx.lineTo(leftEdge + 25, y); ctx.stroke(); 
                  const meters = Math.round((seaY-y) / P_SCALE) / 100;
                  ctx.fillText(`${meters.toFixed(0)}m`, leftEdge + 15, y+4); 
              }
              ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.moveTo(leftEdge + 40, curY); ctx.lineTo(leftEdge + 32, curY - 5); ctx.lineTo(leftEdge + 32, curY + 5); ctx.fill();
              drawHorizontalRuler(ctx, seaY, dockX, P_SCALE);
              // Show anchor label in red if it has been dragged
              ctx.fillStyle = r.anchorDragged ? '#ef4444' : '#10b981'; 
              ctx.textAlign = 'center'; 
              ctx.fillText(r.anchorDragged ? 'ANCHOR (DRAGGED)' : 'ANCHOR', anchorX, seaY + 40);
              ctx.restore();
          }},
          { id: 'hud', draw: () => {
              const trans = t[r.lang] || t['sv'];
              const d = r.debugData || {};
              
              ctx.save(); 
              // Move HUD slightly for more space if needed, or keep same
              ctx.translate(220, 160); 
              ctx.textAlign = 'right';
              
              // --- Standard HUD ---
              ctx.fillStyle = '#0f172a'; ctx.font = 'bold 12px monospace'; 
              const windTxt = `${trans.hudWind}: ${Math.abs(currentWind).toFixed(1)} m/s`;
              const waterTxt = `${trans.hudWater}: ${r.waterLevelCm} cm`;
              const waveTxt = `${trans.hudWaves}: ${r.waveHeightCm} cm`;
              const dockTxt = `${trans.hudDock}: ${r.isFloatingDock ? 'Flyt' : r.dockHeightCm + ' cm'}`;
              const depthTxt = `${trans.hudTotalDepth}: ${r.seabedDepthCm + r.waterLevelCm} cm`;
              
              let y = -40;
              ctx.fillText(windTxt, 0, y); y += 15;
              ctx.fillText(waterTxt, 0, y); y += 15;
              ctx.fillText(depthTxt, 0, y); y += 15;
              ctx.fillText(waveTxt, 0, y); y += 15;
              ctx.fillText(dockTxt, 0, y); y += 15;
              
              // Wind Arrow
              ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; 
              const arrowX = currentWind * 3; 
              ctx.save();
              ctx.translate(90, -45); 
              if (currentWind >= 0) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(arrowX, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(arrowX, 0); ctx.lineTo(arrowX - 8, -4); ctx.lineTo(arrowX - 8, 4); ctx.fill(); } 
              else { ctx.beginPath(); ctx.moveTo(Math.abs(arrowX), 0); ctx.lineTo(0, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4); ctx.fill(); }
              ctx.restore();
              
              // --- Merged Debug Info ---
              y += 10; // Spacer
              
              // Stern
              const sternP = (d.sternDist / d.sternMax) * 100;
              ctx.fillStyle = sternP > 99.9 ? '#ef4444' : '#0f172a'; // Red if stressed
              const sternTxt = `${trans.hudSternLabel}: ${d.sternDist?.toFixed(0)}/${d.sternMax?.toFixed(0)} cm`;
              ctx.fillText(sternTxt, 0, y); y += 15;
              
              ctx.fillStyle = '#0f172a';
              ctx.font = '10px monospace';
              ctx.fillText(`${d.sternTension?.toFixed(1) || 0} N`, 0, y); y += 15;
              ctx.font = 'bold 12px monospace'; // Reset font

              // Bow
              const frontP = (d.frontDist / d.frontMax) * 100;
              ctx.fillStyle = frontP > 99.9 ? '#ef4444' : '#0f172a';
              const bowTxt = `${trans.hudBowLabel}: ${d.frontDist?.toFixed(0)}/${d.frontMax?.toFixed(0)} cm`;
              ctx.fillText(bowTxt, 0, y); y += 15;
              
              ctx.fillStyle = '#0f172a';
              ctx.font = '10px monospace';
              ctx.fillText(`${d.frontTension?.toFixed(1) || 0} N`, 0, y); y += 15;
              ctx.font = 'bold 12px monospace';

              // Forces
              y += 5;
              ctx.fillStyle = '#0f172a';
              ctx.fillText(`${trans.hudWindForce}: ${d.windForce?.toFixed(1) || 0} N`, 0, y); y += 15;
              ctx.fillText(`${trans.hudNetForce}: ${d.totalForce?.toFixed(1) || 0} N`, 0, y); y += 15;
              
              // Chain & Rope Forces
              ctx.fillStyle = '#1e293b'; 
              ctx.fillText(`${trans.hudRopeForce}: ${d.ropeForce?.toFixed(1) || 0} N`, 0, y); y += 15;
              ctx.fillText(`${trans.hudChainForce}: ${d.chainForce?.toFixed(1) || 0} N`, 0, y); y += 15;
              
              // Anchor Force
              ctx.fillStyle = (d.sternTension > ANCHOR_HOLD_FORCE) ? '#ef4444' : '#1e293b';
              ctx.fillText(`Anchor Load: ${d.sternTension?.toFixed(1) || 0} / ${ANCHOR_HOLD_FORCE} N`, 0, y);

              ctx.restore();
          }}
      ];

      // --- EXECUTE RENDER PASSES (excluding HUD) ---
      const allLayers = [...backgroundLayer, ...midLayer, ...foregroundLayer];
      const hudLayer = allLayers.find(l => l.id === 'hud');
      allLayers.filter(l => l.id !== 'hud').forEach(layer => layer.draw());

      // Restore zoom transform
      ctx.restore();

      // Draw HUD AFTER zoom restore (fixed position like title)
      if (hudLayer) hudLayer.draw();

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions, isSunk, language, zoom]);

// --- PROCEDURAL LANDSCAPE ---
function drawLandscape(ctx, w, seaLevel, wind, time, viewOffsetX = 0, dockX = 0) {
    // Use large fixed bounds to ensure coverage at any zoom level
    const startX = -1000;
    const totalW = w + 2000;
    
    // Rocks (Massive Granite Coast)
    ctx.fillStyle = '#94a3b8'; // Slate-400 (Granite)
    ctx.beginPath();
    ctx.moveTo(startX, seaLevel + 500); // Start below sea level
    ctx.lineTo(startX, seaLevel - 350); // Up to mountain
    ctx.bezierCurveTo(startX + totalW * 0.15, seaLevel - 420, startX + totalW * 0.25, seaLevel - 380, startX + totalW * 0.35, seaLevel - 400);
    ctx.bezierCurveTo(startX + totalW * 0.45, seaLevel - 350, startX + totalW * 0.55, seaLevel - 440, startX + totalW * 0.65, seaLevel - 360);
    ctx.bezierCurveTo(startX + totalW * 0.75, seaLevel - 300, startX + totalW * 0.85, seaLevel - 380, startX + totalW, seaLevel - 320);
    ctx.lineTo(startX + totalW, seaLevel + 500);
    ctx.closePath();
    ctx.fill();

    // Secondary Rock Layer (Darker base/Mid-ground)
    ctx.fillStyle = '#64748b'; // Slate-500
    ctx.beginPath();
    ctx.moveTo(startX, seaLevel + 500);
    ctx.lineTo(startX, seaLevel - 120);
    ctx.quadraticCurveTo(startX + totalW * 0.2, seaLevel - 180, startX + totalW * 0.4, seaLevel - 100);
    ctx.quadraticCurveTo(startX + totalW * 0.6, seaLevel - 140, startX + totalW * 0.8, seaLevel - 80);
    ctx.quadraticCurveTo(startX + totalW * 0.9, seaLevel - 100, startX + totalW, seaLevel);
    ctx.lineTo(startX + totalW, seaLevel + 500);
    ctx.closePath();
    ctx.fill();

    // Boat Houses (Sjöbodar)
    // Helper to draw a hut
    const drawHut = (x, y, scale) => {
        const hW = 60 * scale; 
        const hH = 50 * scale; 
        const roofH = 25 * scale;

        // Base/Platform removed


        // Walls (Falu Red)
        ctx.fillStyle = '#7f1d1d'; // Deep Red
        ctx.fillRect(x, y - hH, hW, hH);

        // White Corners/Trim
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(x, y - hH, 4 * scale, hH); // Left
        ctx.fillRect(x + hW - (4 * scale), y - hH, 4 * scale, hH); // Right
        
        // Door
        ctx.fillStyle = '#1e293b'; // Dark door
        ctx.fillRect(x + (hW/2) - (10*scale), y - hH, 20*scale, 35*scale);
        // Door Frame
        ctx.lineWidth = 2 * scale;
        ctx.strokeStyle = '#f1f5f9';
        ctx.strokeRect(x + (hW/2) - (10*scale), y - hH, 20*scale, 35*scale);

        // Roof (Black/Dark Grey tiles)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(x - (5*scale), y - hH);
        ctx.lineTo(x + (hW/2), y - hH - roofH);
        ctx.lineTo(x + hW + (5*scale), y - hH);
        ctx.fill();
        
        // Roof Trim
        ctx.beginPath();
        ctx.moveTo(x, y - hH);
        ctx.lineTo(x + (hW/2), y - hH - roofH);
        ctx.lineTo(x + hW, y - hH);
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
    };

    // Place Huts Higher Up on the new peaks
    
    // --- STATIC DOCK UNDER HUTS ---
    // Use the passed dockX to position the background dock relative to main dock
    const mainDockEnd = dockX + 150; // Main dock extends 150px from dockX
    const dockStart = mainDockEnd; // Hut dock starts at end of main dock
    const dockEnd = w + 500; // Extend way to the right
    const dockY = seaLevel - 215;
    
    // 1. Pillars (Dark Wood)
    ctx.fillStyle = '#3f3f46'; // zinc-700
    // Draw a pillar every ~50px
    for (let x = dockStart + 20; x < dockEnd; x += 55) {
        ctx.fillRect(x, dockY, 8, 300); // Go deep down
    }
    
    // 2. Boardwalk Surface
    ctx.fillStyle = '#78350f'; // amber-900 (Dark Wood)
    ctx.fillRect(dockStart, dockY, dockEnd - dockStart, 12);
    
    // 3. Railing (Optional detail)
    ctx.fillStyle = '#92400e'; // lighter wood
    ctx.fillRect(dockStart, dockY - 14, dockEnd - dockStart, 4); // Top rail
    
    // Huts on rocks (background)
    drawHut(w * 0.35, seaLevel - 330, 1.0);
    drawHut(w * 0.57, seaLevel - 330, 1.0);
    drawHut(w * 0.60, seaLevel - 320, 1.0);
    
    // Huts on dock - start from end of main dock, evenly spaced
    const hutScale = 0.85;
    const hutWidth = 60 * hutScale; // Base hut width
    const hutSpacing = hutWidth + 8; // Add 8px gap between huts
    
    let hutX = mainDockEnd + 10; // Start 10px after main dock ends
    for (let i = 0; i < 16; i++) {
        drawHut(hutX, seaLevel - 215, hutScale);
        hutX += hutSpacing;
    }
    
    // --- SWEDISH FLAG ---
    const drawFlag = (fx, fy, scale) => {
         const poleH = 120 * scale;
         
         // 1. Pole (White/Grey)
         ctx.lineWidth = 3 * scale;
         ctx.strokeStyle = '#e2e8f0';
         ctx.beginPath();
         ctx.moveTo(fx, fy);
         ctx.lineTo(fx, fy - poleH);
         ctx.stroke();
         
         // Knob at top
         ctx.fillStyle = '#f59e0b';
         ctx.beginPath(); 
         ctx.arc(fx, fy - poleH, 3 * scale, 0, Math.PI*2); 
         ctx.fill();
         
         // 2. Flag dimensions
         const fW = 60 * scale;
         const fH = 37.5 * scale;
         const startY = fy - poleH + (2 * scale);
         
         // Wind direction
         const safeWind = wind || 0;
         const windSpeed = Math.abs(safeWind);
         const direction = safeWind >= 0 ? 1 : -1;
         
         // Animation parameters:
         // - Amplitude is CONSTANT at 4 pixels
         // - Frequency INCREASES with wind speed
         const waveAmp = 4;
         const baseFreq = 1.0;  // Base oscillation speed
         const windFreq = baseFreq + (windSpeed * 0.1);  // Max 5 at 40 m/s
         
         // Use 'time' for animation (passed to drawLandscape)
         const phase = time * windFreq;
         
         // Number of wave segments along the flag
         const segments = 12;
         const segW = fW / segments;
         
         // Helper: get wave offset at segment i
         // Wave travels from pole to tip (subtracting i creates traveling wave)
         const getWave = (i) => Math.sin(phase - i * 0.6) * waveAmp;
         
         // Sag: flag droops more when wind is low
         const getSag = (x) => Math.max(0, (1 - (windSpeed / 10))) * (x * 0.5);
         
         // --- Draw Blue Background ---
         ctx.fillStyle = '#006aa7';
         ctx.beginPath();
         ctx.moveTo(fx, startY);
         
         // Top edge
         for(let i = 0; i <= segments; i++) {
             const x = i * segW;
             const wave = getWave(i);
             const sag = getSag(x);
             ctx.lineTo(fx + (x * direction), startY + wave + sag);
         }
         
         // Right edge (connect top to bottom)
         const endWave = getWave(segments);
         const endSag = getSag(fW);
         ctx.lineTo(fx + (fW * direction), startY + fH + endWave + endSag);
         
         // Bottom edge (backwards)
         for(let i = segments; i >= 0; i--) {
             const x = i * segW;
             const wave = getWave(i);
             const sag = getSag(x);
             ctx.lineTo(fx + (x * direction), startY + fH + wave + sag);
         }
         
         ctx.closePath();
         ctx.fill();
         
         // --- Yellow Horizontal Cross Bar ---
         ctx.fillStyle = '#fecc00';
         const crossH_Y = startY + (fH * 0.4);
         const crossH_H = fH * 0.2;
         
         ctx.beginPath();
         for(let i = 0; i <= segments; i++) {
             const x = i * segW;
             const wave = getWave(i);
             const sag = getSag(x);
             const pX = fx + (x * direction);
             const pY = crossH_Y + wave + sag;
             if(i === 0) ctx.moveTo(pX, pY); else ctx.lineTo(pX, pY);
         }
         for(let i = segments; i >= 0; i--) {
             const x = i * segW;
             const wave = getWave(i);
             const sag = getSag(x);
             const pX = fx + (x * direction);
             const pY = crossH_Y + crossH_H + wave + sag;
             ctx.lineTo(pX, pY);
         }
         ctx.closePath();
         ctx.fill();
         
         // --- Yellow Vertical Cross Bar ---
         const crossV_X = fW * 0.3125;
         const crossV_W = fW * 0.125;
         
         const vWaveIdx = crossV_X / segW;
         const vWave = getWave(vWaveIdx);
         const vSag = getSag(crossV_X);
         
         const vX1 = fx + (crossV_X * direction);
         const vX2 = fx + ((crossV_X + crossV_W) * direction);
         
         ctx.beginPath();
         ctx.moveTo(vX1, startY + vWave + vSag);
         ctx.lineTo(vX2, startY + vWave + vSag);
         ctx.lineTo(vX2, startY + fH + vWave + vSag);
         ctx.lineTo(vX1, startY + fH + vWave + vSag);
         ctx.closePath();
         ctx.fill();
    };

    // Place Flag on High Rock (Left Peak) - MOVING to saddle point
    drawFlag(w * 0.45, seaLevel - 335, 0.8);

}



  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-full h-screen bg-sky-200 overflow-hidden font-sans text-white text-center">
      <SimulatorControls 
        txt={txt}
        startLanguage={language}
        setLanguage={setLanguage}
        weatherMode={weatherMode}
        setWeatherMode={setWeatherMode}
        waterLevelCm={waterLevelCm}
        setWaterLevelCm={setWaterLevelCm}
        seabedDepthCm={seabedDepthCm}
        setSeabedDepthCm={setSeabedDepthCm}
        dockHeightCm={dockHeightCm}
        setDockHeightCm={setDockHeightCm}
        isFloatingDock={isFloatingDock}
        setIsFloatingDock={setIsFloatingDock}
        isSunk={isSunk}
        waveHeightCm={waveHeightCm}
        setWaveHeightCm={setWaveHeightCm}
        windSpeedMs={windSpeedMs}
        setWindSpeedMs={setWindSpeedMs}
        windDirection={windDirection}
        setWindDirection={setWindDirection}
        sternTotalLengthCm={sternTotalLengthCm}
        setSternTotalLengthCm={setSternTotalLengthCm}
        sternChainPercent={sternChainPercent}
        setSternChainPercent={setSternChainPercent}
        setSternChainLengthCm={setSternChainLengthCm}
        setSternRopeLengthCm={setSternRopeLengthCm}
        chainThickness={chainThickness}
        setChainThickness={setChainThickness}
        anchorPositionXCm={anchorPositionXCm}
        setAnchorPositionXCm={setAnchorPositionXCm}
        bowRopeLengthCm={bowRopeLengthCm}
        setBowRopeLengthCm={setBowRopeLengthCm}
        boatLengthCm={boatLengthCm}
        setBoatLengthCm={setBoatLengthCm}
      isAnchorDragged={isAnchorDragged}
      dragDistance={dragDistance}
      />

      <div className="absolute top-10 left-10 pointer-events-none text-left">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none border-l-4 border-sky-600 pl-4 text-sky-900">{txt.mainTitle}</h1>
        <p className="text-[9px] mt-2 pl-4 uppercase font-bold tracking-widest text-sky-700 italic opacity-80">{txt.simulatorVersion}</p>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-20">
        <button 
          onClick={() => setZoom(z => Math.min(2, z + 0.1))}
          className="w-10 h-10 bg-white/90 hover:bg-white rounded-lg shadow-lg flex items-center justify-center text-xl font-bold text-sky-800 transition-all hover:scale-105"
        >
          +
        </button>
        <div className="text-center text-xs font-bold text-sky-800 bg-white/80 rounded px-2 py-1">
          {Math.round(zoom * 100)}%
        </div>
        <button 
          onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
          className="w-10 h-10 bg-white/90 hover:bg-white rounded-lg shadow-lg flex items-center justify-center text-xl font-bold text-sky-800 transition-all hover:scale-105"
        >
          −
        </button>
      </div>

      {/* Portrait Mode Overlay for Mobile */}
      {showRotatePrompt && (
        <div className="absolute inset-0 bg-sky-900/95 z-50 flex flex-col items-center justify-center text-white p-8">
          <div className="text-6xl mb-6 animate-pulse">📱↻</div>
          <h2 className="text-2xl font-bold mb-4 text-center">
            {language === 'sv' ? 'Rotera skärmen' : 'Rotate your screen'}
          </h2>
          <p className="text-center text-sky-200 max-w-sm">
            {language === 'sv' 
              ? 'Denna simulator fungerar bäst i landskapsläge. Vrid din enhet 90° för bästa upplevelse.'
              : 'This simulator works best in landscape mode. Please rotate your device 90° for the best experience.'}
          </p>
          <div className="mt-8 text-5xl animate-bounce">
            🔄
          </div>
        </div>
      )}

      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="block touch-none" />
    </div>
  );
};

export default App;