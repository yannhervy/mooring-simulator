import React, { useEffect, useRef, useState } from 'react';
import SimulatorControls from './components/SimulatorControls';
import { translations as t } from './translations';
import { solveCatenary } from './utils/catenary';

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
  const [seabedDepthCm, setSeabedDepthCm] = useState(100); 
  const [waveHeightCm, setWaveHeightCm] = useState(10); 
  
  const [dockHeightCm, setDockHeightCm] = useState(200); 
  const [isFloatingDock, setIsFloatingDock] = useState(false);

  // --- CONFIGURATION ---
  // Ändra dessa värden för att ställa in default-läget
  const CONFIG = {
      defaultSternTotal: 720,
      defaultChainPercent: 70
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
  const [bowRopeLengthCm, setBowRopeLengthCm] = useState(120); 
  const [anchorPositionXCm, setAnchorPositionXCm] = useState(1000);
  const [boatLengthCm, setBoatLengthCm] = useState(300); 
  
  const [windSpeedMs, setWindSpeedMs] = useState(15); 
  const [windDirection, setWindDirection] = useState(1); 
  const [chainThickness, setChainThickness] = useState(10); 
  
  const [weatherMode, setWeatherMode] = useState('OFF');
  const [isSunk, setIsSunk] = useState(false);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const calculateWeight = (d) => 0.0050 * Math.pow(d, 2);
  const ROPE_WEIGHT_PER_M = 0.5;

  const txt = t[language];

  // Wave Constants
  const WAVE_SPEED_CM_S = 100; 
  const WAVE_LENGTH_CM = 600;  
  const WAVE_K = (2 * Math.PI) / WAVE_LENGTH_CM; 

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
    debugData: { sternDist: 0, sternMax: 0, frontDist: 0, frontMax: 0 }
  });

  // Synka refs
  useEffect(() => {
    if (weatherMode === 'OFF') {
        if (refs.current.isSunk) {
             refs.current.isSunk = false;
             refs.current.sinkingY = 0;
             setIsSunk(false);
        }
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
    setSeabedDepthCm(100);
    setDockHeightCm(200);
    setWaveHeightCm(10);
    setWaveHeightCm(10);
    setWaveHeightCm(10);
    setSternTotalLengthCm(CONFIG.defaultSternTotal);
    setSternChainPercent(CONFIG.defaultChainPercent);
    setSternChainLengthCm(initChain);
    setSternRopeLengthCm(initRope);
    setBowRopeLengthCm(120);
    setAnchorPositionXCm(1200);
    setBoatLengthCm(300);
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
        setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
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
      
      const halfL = length / 2;
      const height = length * 0.3;
      const verticalOffset = -height / 2; 

      // Skrov
      ctx.fillStyle = state === 'colliding' || state === 'critical' || state === 'sunk' ? '#ef4444' : (state === 'stressed' ? '#fca5a5' : '#ffffff');
      ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 4;
      ctx.beginPath(); 
      ctx.moveTo(-halfL, verticalOffset); 
      ctx.lineTo(halfL, verticalOffset); 
      ctx.lineTo(halfL - (length*0.13), verticalOffset + height); 
      ctx.lineTo(-halfL + (length*0.13), verticalOffset + height); 
      ctx.closePath(); ctx.fill();
      
      // Mast
      ctx.strokeStyle = state !== 'normal' ? '#7f1d1d' : '#334155'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, verticalOffset); ctx.lineTo(0, verticalOffset - (length * 0.6)); ctx.stroke();
      
      // Segel
      const sailColor = state !== 'normal' ? '#b91c1c' : '#38bdf8';
      ctx.fillStyle = sailColor;
      const sailSide = currentWind >= 0 ? 1 : -1;
      
      ctx.beginPath(); 
      ctx.moveTo(2 * sailSide, verticalOffset - (length * 0.55)); 
      ctx.lineTo((length * 0.4) * sailSide, verticalOffset - (length * 0.3)); 
      ctx.lineTo(2 * sailSide, verticalOffset - 4); 
      ctx.closePath(); 
      ctx.fill();

      // "S"
      ctx.save();
      const textX = (length * 0.15) * sailSide;
      const textY = verticalOffset - (length * 0.25);
      ctx.translate(textX, textY);
      if (sailSide === -1) ctx.scale(-1, 1); 
      ctx.fillStyle = 'white';
      ctx.font = `bold ${Math.max(8, length * 0.15)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 0);
      ctx.restore();

      ctx.restore();
    };

    const drawHorizontalRuler = (ctx, seabedY, dockX) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.3)'; ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 1; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';

      // Base line
      ctx.beginPath(); ctx.moveTo(0, seabedY); ctx.lineTo(dimensions.width, seabedY); ctx.stroke();
      
      // We want to draw ticks relative to the dock.
      // 1 meter = 100px.
      // Find the first meter mark visible on screen (left side, x=0)
      // dockX is at value 0. Left of dock is positive distance? Or negative?
      // Based on previous code: distFromDock = dockX - x.
      // So at x=0, dist = dockX.
      // We want markers at 0, 100, 200, ... from dockX.
      
      const startPixel = 0;
      const endPixel = dimensions.width;
      
      // Iterate every 10 pixels roughly, but align to dock
      // Let's iterate RELATIVE to dockX.
      // Start from closest 10px mark to the left edge
      const firstMarkOffset = Math.ceil((startPixel - dockX) / 10) * 10;
      
      for (let offset = firstMarkOffset; (dockX + offset) <= endPixel; offset += 10) {
          const x = dockX + offset;
          const dist = Math.abs(offset); // Distance from dock in pixels
          
          // Avoid drawing off-screen (though loop condition handles right side, ensure left)
          if(x < 0) continue;

          // Check if it's a meter (100px), half-meter (50px), or decimeter (10px)
          // We use Math.round to avoid float precision issues, though dealing with integers usually.
          const isMeter = Math.round(dist) % 100 === 0;
          const isHalfMeter = Math.round(dist) % 50 === 0;
          
          ctx.beginPath();
          if (isMeter) {
              ctx.moveTo(x, seabedY); ctx.lineTo(x, seabedY + 15); ctx.stroke();
              // Label: Convert px to m. offset 0 is 0m. -100 is 1m (or -1m).
              const label = (offset / -100).toFixed(0) + 'm'; 
              ctx.fillText(label, x, seabedY + 28);
          } else if (isHalfMeter) {
              ctx.moveTo(x, seabedY); ctx.lineTo(x, seabedY + 8); ctx.stroke();
          } else {
              ctx.moveTo(x, seabedY); ctx.lineTo(x, seabedY + 4); ctx.stroke();
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
      time += 0.02;
      const r = refs.current;
      const chainW = calculateWeight(r.thickness);
      const totStern = r.sternChainLengthCm + r.sternRopeLengthCm;
      const effectiveSagWeight = totStern > 0 ? ((chainW * r.sternChainLengthCm) + (ROPE_WEIGHT_PER_M * r.sternRopeLengthCm)) / totStern : chainW;
      
      const waveVar = 1 + 0.2 * Math.sin(time * 0.7); 
      const currentAmp = r.waveHeightCm * waveVar;

      const phaseSpeed = (WAVE_SPEED_CM_S / 60) * WAVE_K * r.windDir; 
      r.wavePhase -= phaseSpeed; 

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // --- VÄDERGRAFIK BERÄKNING ---
      // Vindfaktor 0 (stiltje) till 1 (storm 20+ m/s)
      const windFactor = Math.min(1, Math.abs(r.windSpeedMs) / 20); 
      
      // Himmelsfärg: Vitare/Gråare vid vind (Overcast)
      // Sky-200: 186, 230, 253 -> Slate-300: 203, 213, 225
      const sFactor = windFactor * 0.8; 
      const rSky = 186 + ((203 - 186) * sFactor);
      const gSky = 230 + ((213 - 230) * sFactor);
      const bSky = 253 + ((225 - 253) * sFactor);
      
      ctx.fillStyle = `rgb(${Math.round(rSky)},${Math.round(gSky)},${Math.round(bSky)})`;
      ctx.fillRect(0,0, dimensions.width, dimensions.height); // Rita himmel
      
      const b0Y = dimensions.height * 0.6; 
      const curY = b0Y - r.waterLevelCm;
      const seaY = b0Y + r.seabedDepthCm; 
      
      let catenaryPoints = null; 
      let bowCatenaryPoints = null; 
      
      // Dynamisk bryggposition för att hantera stora båtar
      // Bryggan flyttas så att den alltid är "framför" båten vid start
      const dockX = (dimensions.width / 2) + Math.max(200, r.boatLengthCm * 0.7); 
      // Ankaret positioneras nu relativt bryggan för att matcha linjalen (Slider 1000cm = 10m från bryggan)
      const anchorX = dockX - r.anchorPositionXCm;
      const currentWind = r.windSpeedMs * (1 + (Math.sin(time * 0.45) * 0.35 + 0.35)) * r.windDir;

      let dockY;
      if (r.isFloatingDock) {
        const dockWaveOffset = Math.sin(dockX * WAVE_K + r.wavePhase) * currentAmp;
        dockY = curY + dockWaveOffset - 15; 
      } else {
        dockY = seaY - r.dockHeightCm; 
      }

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

      // Draw Landscape (Procedural Rocks + Huts)
      drawLandscape(ctx, dimensions.width, seaY);

      drawRain(ctx, Math.abs(r.windSpeedMs), r.windDir);

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

      const halfL = r.boatLengthCm / 2;
      const boatHeight = r.boatLengthCm * 0.3;
      const deckHeightOffset = boatHeight / 2;

      const maxSternStretch = r.sternChainLengthCm + (r.sternRopeLengthCm * 1.03); 
      const maxFrontStretch = r.bowRopeLengthCm * 1.10; 

      if (r.isSunk) {
        r.sinkingY += 0.5;
        boatXAbs = (dimensions.width / 2) + r.boatX;
        let maxSinkY = seaY - (halfL * 0.6); 
        let currentSinkY = (curY + r.sinkingY);
        if (currentSinkY >= maxSinkY) currentSinkY = maxSinkY;
        boatFinalY = currentSinkY;
        totalAngle = Math.PI / 12;
        bState = 'sunk';
        const cosA = Math.cos(totalAngle); const sinA = Math.sin(totalAngle);
        sternAttachX = boatXAbs + (-halfL * cosA - (-deckHeightOffset) * sinA);
        sternAttachY = boatFinalY + (-halfL * sinA + (-deckHeightOffset) * cosA);
        bowAttachX = boatXAbs + (halfL * cosA - (-deckHeightOffset) * sinA);
        bowAttachY = boatFinalY + (halfL * sinA + (-deckHeightOffset) * cosA);
        sTaut = false; fTaut = true; fCritical = true;
        distS = Math.sqrt(Math.pow(sternAttachX - anchorX, 2) + Math.pow(sternAttachY - seaY, 2));
        distF = Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2));
      } else {
        // --- PHYSICS UPDATE ---
        // --- PHYSICS UPDATE ---
        // 1. Mass Calculation (Approx 1000kg for 5m boat, scaling partly cubic/quadratic)
        // Simplified: 800kg + (Length - 300) * 4
        // 3m -> 800kg. 5m -> 1600kg. 10m -> 3600kg.
        const mass = 800 + (r.boatLengthCm - 300) * 4;

        // 2. Wind Force (Standard Physics: F = 0.5 * rho * A * v^2)
        // Projected Area approx 2.0 m2 for 5m boat. Scales linearly with length?
        // Let's assume height grows slightly with length.
        // A = 2.0 * (Length / 500)
        const projectedArea = 2.0 * (r.boatLengthCm / 500); 
        const airRho = 1.225;
        // currentWind is in m/s.
        const vWind = Math.abs(currentWind);
        const windForceMag = 0.5 * airRho * projectedArea * (vWind * vWind);
        windForce = Math.sign(currentWind) * windForceMag;
        
        // Resistance
        if (typeof r.boatVX === 'undefined' || isNaN(r.boatVX)) r.boatVX = 0;

        // Force Accumulator
        forceX = windForce; // Start with wind
        
        // 3. Water Drag (Hydrodynamic)
        // Fd = 0.5 * rho * Cd * A * v^2
        // A_submerged (Sideways/Keel) ~ Length * Draft (0.5m)
        const submergedArea = (r.boatLengthCm / 100) * 0.5; // 2.5 m2 for 5m boat
        const waterRho = 1000;
        const Cd_Water = 1.0; // Flat plate approx for keel/side
        
        const vBoat = Math.abs(r.boatVX);
        const dragMag = 0.5 * waterRho * Cd_Water * submergedArea * (vBoat * vBoat);
        
        // Direction opposes velocity
        const dragForce = -Math.sign(r.boatVX) * dragMag;
        
        // Add linear viscous drag for very low speeds (stopping)
        const viscousDrag = -r.boatVX * 50.0;
        
        forceX += (dragForce + viscousDrag); 

        // 3. Chain Drag (if moving and chain is slack)
        // If extension is low, we assume chain is dragging on seabed -> higher friction
        // We use the previously calculated extensionRatio or distToAnchor
        const currentBoatXAbs = (dimensions.width / 2) + r.boatX;
        const currentSternX = currentBoatXAbs - halfL;
        const currentBowX = currentBoatXAbs + halfL;
        const maxSternReach = r.sternChainLengthCm + r.sternRopeLengthCm;
        const physDxS = Math.abs(currentSternX - anchorX);
        const distToAnchor = Math.hypot(physDxS, Math.abs(seaY - (curY - deckHeightOffset)));
        
           // sternTensionX is already declared
           // catenaryPoints is defined in top scope

           if (maxSternReach > 0) {
               // Uses real Catenary Physics
               // Calculate average weight per unit roughly (simplified model)
               // chainW is ~0.5. ROPE ~0.5. 
               // We treat the whole line as having the weight of the CHAIN for safety margin in simulation, or average.
               // Let's use effectiveSagWeight logic from render loop here too.
               const totStern = r.sternChainLengthCm + r.sternRopeLengthCm;
               const chainW = calculateWeight(r.thickness); // ~0.5
               // Average weight per cm
               const w = totStern > 0 ? ((chainW * r.sternChainLengthCm) + (ROPE_WEIGHT_PER_M * r.sternRopeLengthCm)) / totStern : chainW;
               
               // Solve Catenary using ELEVATION (Height above seabed)
               // Boat Elevation: seaY - (curY - deckHeightOffset)
               // Anchor Elevation: seaY - seaY = 0
               // This ensures we solve a standard hanging chain in gravity field.
               const boatElev = seaY - (curY - deckHeightOffset);
               const anchorElev = 0;
               
               // Solve from Boat (x=0) to Anchor (x=physDxS)
               const result = solveCatenary(0, boatElev, physDxS, anchorElev, maxSternReach);
               
               if (result.isStraight) {
                   // Taut line logic (Elastic)
                   // ... existing logic ...
                   const dist = Math.sqrt(physDxS*physDxS + boatElev*boatElev);
                   const extensionRatio = Math.min(0.99, dist / maxSternReach);
                   const tensionForce = (w * maxSternReach) * (Math.pow(extensionRatio, 2) / (1 - extensionRatio)) * 10.0;
                   const angle = Math.atan2(boatElev, physDxS); // Angle of elevation
                   sternTensionX = tensionForce * Math.cos(angle);
                   
                   catenaryPoints = result.drawPoints;
               } else {
                   // Catenary logic
                   const H = Math.abs(result.a * w); 
                   sternTensionX = H;
                   
                   catenaryPoints = result.drawPoints;

                   if (result.a < 500) {
                        forceX -= r.boatVX * (chainW * 5.0);
                   }
               }
           }

        // 4. Bow Tension (Simple Spring)
        const currentBowY = curY - deckHeightOffset;
        const physDxF = currentBowX - dockX; // Positive if boat is right of dock
        const physDyF = currentBowY - dockY;
        const distF_Phys = Math.sqrt(physDxF*physDxF + physDyF*physDyF);
        
        if (r.bowRopeLengthCm > 0) {
             const maxBowReach = r.bowRopeLengthCm;
             
             if (distF_Phys > maxBowReach) {
                 // Over-stretched: Linear Spring (Stiff)
                 const stretch = distF_Phys - maxBowReach;
                 const k = 100.0; // Force per cm
                 const baseTension = 2000.0; 
                 // Total tension magnitude
                 const T = baseTension + (stretch * k);
                 
                 // X-component
                 const angle = Math.atan2(physDyF, physDxF); // angle from dock to boat? No, physDxF is boat-dock.
                 // Force pulls boat towards dock.
                 // Vector D = Dock - Boat.
                 // DockX - CurrentBowX = -physDxF.
                 // DockY - CurrentBowY = -physDyF.
                 const angleToDock = Math.atan2(-physDyF, -physDxF);
                 
                 bowTensionX = Math.abs(T * Math.cos(angleToDock));
                 
                 // Apply Damping
                 if (Math.abs(r.boatVX) > 0.01) {
                     // Damping aligns with velocity, opposes it.
                     const damping = r.boatVX * 150.0;
                     // Only apply if checking direction?
                     // Simple drag is fine.
                     forceX -= damping;
                 }
             } else {
                 bowTensionX = 0;
             }
        }

        const sternForceSign = currentSternX > anchorX ? -1 : 1;
        const bowForceSign = currentBowX < dockX ? 1 : -1;
        
        // Apply Rope Damping
        if (bowTensionX > 100) {
             forceX -= (r.boatVX * 100); 
        }

        forceX += (sternTensionX * sternForceSign);
        forceX += (bowTensionX * bowForceSign);

        // Integration (Euler)
        const accelX = forceX / mass;
        r.boatVX += accelX * 0.05; 
        r.boatVX *= 0.98; 
        
        // NaN Guard
        if (isNaN(r.boatVX)) { console.warn("NaN detected in boatVX, resetting"); r.boatVX = 0; }
        
        r.boatX += r.boatVX;
        if (isNaN(r.boatX)) { console.warn("NaN detected in boatX, resetting"); r.boatX = 0; }
        
        if (Math.abs(r.boatVX) < 0.01 && Math.abs(forceX) < 1.0) r.boatVX = 0;

        let tempBoatXAbs = (dimensions.width / 2) + r.boatX;
        let natY = curY + Math.sin(tempBoatXAbs * WAVE_K + r.wavePhase) * currentAmp;
        
        // Clamping logic
        const attachY = natY - deckHeightOffset;
        const dyF = Math.abs(attachY - dockY);
        const dyS = Math.abs(attachY - seaY);

        let allowedDxFront = 0;
        if (dyF < maxFrontStretch) allowedDxFront = Math.sqrt(Math.pow(maxFrontStretch, 2) - Math.pow(dyF, 2));
        
        let allowedDxStern = 0;
        if (dyS < maxSternStretch) allowedDxStern = Math.sqrt(Math.pow(maxSternStretch, 2) - Math.pow(dyS, 2));

        const minX_Front = dockX - allowedDxFront - halfL; 
        const maxX_Front = dockX + allowedDxFront - halfL;
        const minX_Stern = anchorX - allowedDxStern + halfL;
        const maxX_Stern = anchorX + allowedDxStern + halfL;

        // --- CONSOLE DEBUG LOGGER (Every 5s) ---
        const now = Date.now();
        if (now - lastLog > 5000) {
            console.log("--- PHYSICS DEBUG ---");
            console.table({
                BoatX: r.boatX.toFixed(1),
                BoatVX: r.boatVX.toFixed(3),
                WindForce: windForce.toFixed(0),
                BowTension: bowTensionX.toFixed(0),
                TotalForce: forceX.toFixed(0),
                MinX_Front: minX_Front.toFixed(0),
                CurrentX_Abs: tempBoatXAbs.toFixed(0),
                DistF: (dockX - (tempBoatXAbs + halfL)).toFixed(1),
                MaxFrontStretch: maxFrontStretch.toFixed(1),
                Diff_Clamp: (tempBoatXAbs - minX_Front).toFixed(1)
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
        r.boatX = boatXAbs - (dimensions.width / 2);
        
        natY = curY + Math.sin(boatXAbs * WAVE_K + r.wavePhase) * currentAmp;
        const nextY = curY + Math.sin((boatXAbs+1) * WAVE_K + r.wavePhase) * currentAmp;
        const waveAngle = Math.atan2(nextY - natY, 1);

        let tiltAngle = 0;
        if (dyF > maxFrontStretch) {
             const hangY = dockY + maxFrontStretch + deckHeightOffset; 
             tiltAngle = Math.atan2(hangY - natY, halfL); 
        }

        totalAngle = waveAngle + tiltAngle;
        
        if (r.boatLengthCm > 300) {
            totalAngle *= 0.5; 
        }

        // --- GEOMETRIC SOLVER ---
        const sxLocal = -halfL; const syLocal = -deckHeightOffset;
        const fxLocal = halfL; const fyLocal = -deckHeightOffset;
        
        const keelOffset = r.boatLengthCm * 0.15; 
        const groundLimitY = seaY - keelOffset;    
        
        const estBowX = boatXAbs + halfL;
        const estSternX = boatXAbs - halfL;
        
        const bowNatY = curY + Math.sin(estBowX * WAVE_K + r.wavePhase) * currentAmp;
        const sternNatY = curY + Math.sin(estSternX * WAVE_K + r.wavePhase) * currentAmp;
        
        let newBowY = bowNatY;
        if (newBowY > groundLimitY) newBowY = groundLimitY;
        
        const dxF = Math.abs(estBowX - dockX);
        const maxRopeF = r.bowRopeLengthCm * 1.05; 
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
        const physDxS_Render = Math.abs(sternAttachX - anchorX);
        const sternElev = seaY - sternAttachY; 
        const anchorElev = 0;
        if (maxRopeS > 0) {
             const result = solveCatenary(0, sternElev, physDxS_Render, anchorElev, maxRopeS);
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
            totalForce: forceX
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
              [30, -20].forEach((o, idx) => {
                ctx.beginPath(); ctx.moveTo(0, dimensions.height);
                for (let i = 0; i <= dimensions.width; i++) ctx.lineTo(i, curY + o + Math.sin(i * WAVE_K + r.wavePhase + idx) * (currentAmp * 0.7));
                ctx.lineTo(dimensions.width, dimensions.height); ctx.fill();
              });
          }},
          { id: 'seabed', draw: () => {
              const seabedGrad = ctx.createLinearGradient(0, seaY, 0, dimensions.height);
              seabedGrad.addColorStop(0, '#eab308'); seabedGrad.addColorStop(1, '#a16207');
              ctx.fillStyle = seabedGrad; ctx.fillRect(0, seaY, dimensions.width, dimensions.height - seaY);
          }},
          { id: 'anchor', draw: () => {
              ctx.save();
              ctx.translate(anchorX, seaY);
              ctx.scale(2.5, 2.5); 
              ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; 
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
                    const sternLeft = sternAttachX < anchorX;
                    const chainLen = r.sternChainLengthCm;
                    
                    // Draw Rope (Boat side)
                    ctx.beginPath(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3;
                    
                    let drawnRope = false;
                    const getPt = (p) => {
                         const sx = sternLeft ? (sternAttachX + p.x) : (sternAttachX - p.x);
                         const sy = Math.min(seaY, seaY - p.y);
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
                         if (len + segLen > r.sternRopeLengthCm) {
                              const s1 = getPt(p1);
                              const s2 = getPt(p2);
                              const linkDist = 10; 
                              const dist = Math.hypot(s2.x - s1.x, s2.y - s1.y);
                              const steps = Math.max(1, Math.floor(dist / linkDist));
                              const angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);

                              for(let k=0; k<steps; k++) {
                                  const t = k/steps;
                                  const currentDistOnLine = len + (segLen * t);
                                  if (currentDistOnLine > r.sternRopeLengthCm) {
                                      const lx = s1.x + (s2.x - s1.x)*t;
                                      const ly = s1.y + (s2.y - s1.y)*t;
                                      ctx.save();
                                      ctx.translate(lx, ly);
                                      ctx.rotate(angle);
                                      ctx.beginPath();
                                      ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI*2);
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
              const slackF = Math.max(0, r.bowRopeLengthCm - dF_draw);
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
              drawBoat(ctx, boatXAbs, boatFinalY - 4, totalAngle, bState, currentWind, r.boatLengthCm);
          }},
          { id: 'water_front', draw: () => {
              const wA = 0.2; ctx.beginPath(); ctx.moveTo(0, dimensions.height);
              for (let i = 0; i <= dimensions.width; i++) ctx.lineTo(i, curY + Math.sin(i * WAVE_K + r.wavePhase) * currentAmp);
              ctx.lineTo(dimensions.width, dimensions.height); ctx.fillStyle = `rgba(14, 165, 233, ${wA})`; ctx.fill();
          }},
          { id: 'depth_ruler', draw: () => {
              const trans = t[r.lang] || t['sv'];
              ctx.save(); ctx.strokeStyle = 'rgba(15, 23, 42, 0.2)'; ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'; ctx.font = 'bold 14px monospace';
              for (let y = seaY; y > 0; y -= 100) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(25, y); ctx.stroke(); ctx.fillText(`${Math.round(seaY-y)/100}m`, 15, y+4); }
              ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.moveTo(40, curY); ctx.lineTo(32, curY - 5); ctx.lineTo(32, curY + 5); ctx.fill();
              drawHorizontalRuler(ctx, seaY, dockX);
              ctx.fillStyle = '#10b981'; ctx.textAlign = 'center'; ctx.fillText(`ANCHOR`, anchorX, seaY + 40);
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
              ctx.fillText(`${trans.hudNetForce}: ${d.totalForce?.toFixed(1) || 0} N`, 0, y);

              ctx.restore();
          }}
      ];

      // --- EXECUTE RENDER PASSES ---
      [...backgroundLayer, ...midLayer, ...foregroundLayer].forEach(layer => layer.draw());

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions, isSunk, language]);

// --- PROCEDURAL LANDSCAPE ---
// --- PROCEDURAL LANDSCAPE ---
const drawLandscape = (ctx, w, seaLevel, wind, time) => {
    // Rocks (Massive Granite Coast)
    ctx.fillStyle = '#94a3b8'; // Slate-400 (Granite)
    ctx.beginPath();
    ctx.moveTo(0, seaLevel);
    // Peaks doubled: -360 to -450px up
    ctx.bezierCurveTo(w * 0.2, seaLevel - 400, w * 0.4, seaLevel - 300, w * 0.5, seaLevel - 360);
    ctx.bezierCurveTo(w * 0.6, seaLevel - 440, w * 0.8, seaLevel - 240, w, seaLevel - 320);
    ctx.lineTo(w, seaLevel);
    ctx.lineTo(0, seaLevel);
    ctx.fill();

    // Secondary Rock Layer (Darker base/Mid-ground)
    ctx.fillStyle = '#64748b'; // Slate-500
    ctx.beginPath();
    ctx.moveTo(0, seaLevel);
    ctx.quadraticCurveTo(w * 0.3, seaLevel - 160, w * 0.6, seaLevel - 80);
    ctx.quadraticCurveTo(w * 0.8, seaLevel - 120, w, seaLevel);
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
    const dockStart = w * 0.6;
    const dockEnd = w * 1.0;
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
    
    // x=0.15: ~ -330
    // x=0.15: ~ -330
    drawHut(w * 0.35, seaLevel - 330, 1.0);
    
    // x=0.55: ~ -380
    drawHut(w * 0.57, seaLevel - 330, 1.0);
    drawHut(w * 0.60, seaLevel - 320, 1.0);
    
    // x=0.85: ~ -270
    drawHut(w * 0.65, seaLevel - 215, 0.85);
    drawHut(w * 0.67, seaLevel - 215, 0.85);
    drawHut(w * 0.69, seaLevel - 215, 0.85);
    drawHut(w * 0.71, seaLevel - 215, 0.85);
    drawHut(w * 0.73, seaLevel - 215, 0.85);
    drawHut(w * 0.75, seaLevel - 215, 0.85);
    drawHut(w * 0.77, seaLevel - 215, 0.85);
    drawHut(w * 0.79, seaLevel - 215, 0.85);
    drawHut(w * 0.81, seaLevel - 215, 0.85);
    drawHut(w * 0.83, seaLevel - 215, 0.85);
    drawHut(w * 0.85, seaLevel - 215, 0.85);
    drawHut(w * 0.87, seaLevel - 215, 0.85);
    drawHut(w * 0.89, seaLevel - 215, 0.85);
    drawHut(w * 0.91, seaLevel - 215, 0.85);
    drawHut(w * 0.93, seaLevel - 215, 0.85);
    drawHut(w * 0.95, seaLevel - 215, 0.85);
    drawHut(w * 0.97, seaLevel - 215, 0.85);
    drawHut(w * 0.99, seaLevel - 215, 0.85);
    
    // --- SWEDISH FLAG ---
    const drawFlag = (fx, fy, scale) => {
         const poleH = 120 * scale;
         
         // 1. Pole (White/Grey)
         ctx.lineWidth = 3 * scale;
         ctx.strokeStyle = '#e2e8f0'; // slate-200
         ctx.beginPath();
         ctx.moveTo(fx, fy);
         ctx.lineTo(fx, fy - poleH);
         ctx.stroke();
         
         // Knob at top
         ctx.fillStyle = '#f59e0b'; // Gold
         ctx.beginPath(); ctx.arc(fx, fy - poleH, 3 * scale, 0, Math.PI*2); ctx.fill();
         
         // 2. Flag
         // Swedish Flag: Blue background, Yellow cross
         // Prop: 5-2-9 horizontal, 4-2-4 vertical
         // Total W=16, H=10
         const fW = 60 * scale;
         const fH = 37.5 * scale;
         const startY = fy - poleH + (2*scale);
         
         // Wind Physics
         // If Wind > 0 (Right), flag flies Right. If < 0, Left.
         // If Wind = 0, it hangs down.
         const windSpeed = Math.abs(wind);
         const direction = wind >= 0 ? 1 : -1;
         
         // Animation
         const segments = 10;
         const segW = fW / segments;
         
         ctx.fillStyle = '#006aa7'; // Swedish Blue
         
         ctx.beginPath();
         // Top Edge
         ctx.moveTo(fx, startY);
         
         const getFlagOffset = (i, isBottom) => {
             const x = i * segW;
             // Wave: sin(time * speed + i * freq) * amp
             const wave = Math.sin(time * 10 + i * 0.5) * (windSpeed * 0.5); 
             // Sag: y increases with x if wind is low. Max sag at end.
             const sag = (1 - Math.min(1, windSpeed / 5)) * (x * 0.5);
             
             return {
                 x: fx + (x * direction),
                 y: (isBottom ? startY + fH : startY) + wave + sag
             };
         };

         // Draw Top Edge
         for(let i=0; i<=segments; i++) {
             const p = getFlagOffset(i, false);
             ctx.lineTo(p.x, p.y);
         }
         
         // Right Edge
         const pBotRight = getFlagOffset(segments, true);
         ctx.lineTo(pBotRight.x, pBotRight.y);
         
         // Bottom Edge (Backwards)
         for(let i=segments; i>=0; i--) {
             const p = getFlagOffset(i, true);
             ctx.lineTo(p.x, p.y);
         }
         
         ctx.closePath();
         ctx.fill();

         // --- YELLOW CROSS ---
         ctx.fillStyle = '#fecc00'; // Yellow
         
         // Horizontal Bar (Height 2 units out of 10 -> 20%)
         // Vertical center is around 50% visually but legally 4-2-4.
         const crossH_Y = startY + (fH * 0.4);
         const crossH_H = fH * 0.2;
         
         ctx.beginPath();
         // Top of H-Bar
         for(let i=0; i<=segments; i++) {
             const x = i * segW;
             const wave = Math.sin(time * 10 + i * 0.5) * (windSpeed * 0.5);
             const sag = (1 - Math.min(1, windSpeed / 5)) * (x * 0.5);
             const pY = crossH_Y + wave + sag;
             const pX = fx + (x * direction);
             if (i===0) ctx.moveTo(pX, pY); else ctx.lineTo(pX, pY);
         }
         // Bottom of H-Bar
         for(let i=segments; i>=0; i--) {
             const x = i * segW;
             const wave = Math.sin(time * 10 + i * 0.5) * (windSpeed * 0.5);
             const sag = (1 - Math.min(1, windSpeed / 5)) * (x * 0.5);
             const pY = crossH_Y + crossH_H + wave + sag;
             const pX = fx + (x * direction);
             ctx.lineTo(pX, pY);
         }
         ctx.fill();

         // Vertical Bar (Width 2 units out of 16 -> 12.5%. Starts at 5/16 -> ~31%)
         const crossV_XStart = fW * 0.3125;
         const crossV_W = fW * 0.125;
         
         ctx.beginPath();
         // Iterate effectively 'down' the stripe, but we need horizontal segments to match the wave.
         // We draw the "box" of the stripe following the wave.
         
         // Left edge of V-Bar
         // Actually, just drawing it as a filled polygon strip is easier.
         const stripeSegs = 4; 
         
         // Top edge of V-Bar (at Top of flag)
         // Wait, the V-Bar goes from top to bottom of flag.
         // But the wave varies by X. The V-Bar has a width.
         // We can just iterate X from start to end of V-Bar.
         
         // Let's create points for Top Edge of V-Bar area and Bottom Edge of V-Bar area?
         // No, V-Bar runs vertically.
         
         // Correct approach: Draw the shape defined by:
         // x=Start, y=Top..Bottom (waved)
         // x=End, y=Top..Bottom (waved)
         // But Y changes with X.
         
         // Let's approximate.
         // Top edge of flag at V-Bar X range
         const vStart = Math.floor((5/16)*segments);
         const vEnd = Math.ceil((7/16)*segments);
         
         // We can just reuse the main flag shape but clip? No, canvas clipping is expensive/complex in this context.
         // We will just draw a quad strip? 
         // Let's just draw the Vertical Bar by calculating the wave at its center and assuming it's roughly constant Y-shift for its width? No, that looks bad.
         
         // Let's iterate 0 to 1 for the vertical length of the flag? NO.
         // The wave function y(x) is defined.
         // We need to fill the region x \in [vStart, vEnd] and y \in [top(x), bottom(x)].
         
         ctx.beginPath();
         // Top edge of V-bar section
         // We step through X from vStartX to vEndX
         const step = segW / 2;
         for (let x = crossV_XStart; x <= crossV_XStart + crossV_W; x += step) {
             const wave = Math.sin(time * 10 + (x/segW) * 0.5) * (windSpeed * 0.5);
             const sag = (1 - Math.min(1, windSpeed / 5)) * (x * 0.5);
             
             const pX = fx + (x * direction);
             const pY = startY + wave + sag;
             if (x === crossV_XStart) ctx.moveTo(pX, pY);
             else ctx.lineTo(pX, pY);
         }
         // Bottom edge of V-bar section (backwards)
         for (let x = crossV_XStart + crossV_W; x >= crossV_XStart; x -= step) {
              const wave = Math.sin(time * 10 + (x/segW) * 0.5) * (windSpeed * 0.5);
              const sag = (1 - Math.min(1, windSpeed / 5)) * (x * 0.5);
              
              const pX = fx + (x * direction);
              const pY = startY + fH + wave + sag;
              ctx.lineTo(pX, pY);
         }
         ctx.fill();
    };

    // Place Flag on High Rock (Left Peak) - MOVING to saddle point
    drawFlag(w * 0.45, seaLevel - 335, 0.8);

};



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
      />

      <div className="absolute top-10 left-10 pointer-events-none text-left">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none border-l-4 border-sky-600 pl-4 text-sky-900">{txt.mainTitle}</h1>
        <p className="text-[9px] mt-2 pl-4 uppercase font-bold tracking-widest text-sky-700 italic opacity-80">Simulator v10.4</p>
      </div>

      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="block touch-none" />
    </div>
  );
};

export default App;