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
      defaultSternTotal: 750,
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
  
  const [windSpeedMs, setWindSpeedMs] = useState(5); 
  const [windDirection, setWindDirection] = useState(-1); 
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
    windSpeedMs: 5, windDir: -1, thickness: 10, 
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
    setWindSpeedMs(5);
    setWindDirection(-1);
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
      ctx.beginPath(); ctx.moveTo(0, seabedY); ctx.lineTo(dimensions.width, seabedY); ctx.stroke();
      const startX = 0; const endX = dimensions.width;
      for (let x = startX; x <= endX; x += 10) {
        const distFromDock = Math.round(dockX - x); 
        const isMeter = distFromDock % 100 === 0; const isHalfMeter = distFromDock % 50 === 0;
        ctx.beginPath();
        if (isMeter) {
          ctx.moveTo(x, seabedY); ctx.lineTo(x, seabedY + 15); ctx.stroke();
          ctx.fillText(`${(distFromDock / 100).toFixed(0)}m`, x, seabedY + 28);
        } else if (isHalfMeter) { ctx.moveTo(x, seabedY); ctx.lineTo(x, seabedY + 8); ctx.stroke(); } 
        else { ctx.moveTo(x, seabedY); ctx.lineTo(x, seabedY + 4); ctx.stroke(); }
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
               // HYBRID PHYSICS: Simple Rope vs Catenary
               
               if (r.sternChainLengthCm < 50) {
                   // --- PURE ROPE PHYSICS (Weightless) ---
                   // Behaves like simple tether. 0 tension if slack.
                   const physDistS = Math.sqrt(Math.pow(physDxS, 2) + Math.pow(seaY - (curY - deckHeightOffset), 2));
                   
                   if (physDistS > maxSternReach) {
                        const stretch = physDistS - maxSternReach;
                        const k = 100.0;
                        const baseTension = 2000.0;
                        const T = baseTension + (stretch * k);
                        
                        // Angle
                        const boatElev = seaY - (curY - deckHeightOffset);
                        const angle = Math.atan2(boatElev, physDxS);
                        sternTensionX = Math.abs(T * Math.cos(angle));
                        
                        // Damping
                        if (Math.abs(r.boatVX) > 0.01) {
                             forceX -= r.boatVX * 150.0;
                        }
                   } else {
                        sternTensionX = 0;
                   }
                   
                   // No catenary points needed for simple line, handled by renderer fallback or straight line code
                   // But renderer expects catenaryPoints for Stern.
                   // We generate a simple 2-point line for the renderer to consume
                   catenaryPoints = [{x: 0, y: seaY - (curY - deckHeightOffset)}, {x: physDxS, y: 0}];

               } else {
                   // --- CATENARY CHAIN PHYSICS ---
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
                WindForce: windForce.toFixed(0),
                BowTension: bowTensionX.toFixed(0),
                SternTension: sternTensionX.toFixed(0),
                TotalForce: forceX.toFixed(0),
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
             if (r.sternChainLengthCm < 50) {
                 // Pure Rope Mode: Force straight line (2 points)
                 // Start: Boat (x=0, y=sternElev). End: Anchor (x=physDxS_Render, y=0)
                 catenaryPoints = [{x: 0, y: sternElev}, {x: physDxS_Render, y: 0}];
             } else {
                 // Chain Mode: Solve Catenary
                 const result = solveCatenary(0, sternElev, physDxS_Render, anchorElev, maxRopeS);
                 catenaryPoints = result.drawPoints;
             }
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

             if ((sTautReal && r.windDir === -1) || (fTautReal && r.windDir === 1)) {
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

      // -- RENDERING --
      const seabedGrad = ctx.createLinearGradient(0, seaY, 0, dimensions.height);
      seabedGrad.addColorStop(0, '#eab308'); seabedGrad.addColorStop(1, '#a16207');
      ctx.fillStyle = seabedGrad; ctx.fillRect(0, seaY, dimensions.width, dimensions.height - seaY);
      
      if (!r.isFloatingDock) {
        ctx.fillStyle = '#18181b'; 
        ctx.fillRect(dockX + 20, dockY, 12, Math.max(0, seaY - dockY));
        ctx.fillRect(dockX + 110, dockY, 12, Math.max(0, seaY - dockY));
      }
      ctx.fillStyle = '#451a03'; ctx.fillRect(dockX, dockY - 15, 150, 25);

      const trans = t[r.lang] || t['sv'];
      ctx.save(); ctx.strokeStyle = 'rgba(15, 23, 42, 0.2)'; ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'; ctx.font = 'bold 14px monospace';
      for (let y = seaY; y > 0; y -= 100) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(25, y); ctx.stroke(); ctx.fillText(`${Math.round(seaY-y)/100}m`, 15, y+4); }
      ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.moveTo(40, curY); ctx.lineTo(32, curY - 5); ctx.lineTo(32, curY + 5); ctx.fill();
      drawHorizontalRuler(ctx, seaY, dockX);
      ctx.fillStyle = '#10b981'; ctx.textAlign = 'center'; ctx.fillText(`ANKAR`, anchorX, seaY + 40);
      
      // Draw Anchor Icon
      ctx.save();
      ctx.translate(anchorX, seaY);
      ctx.scale(2.5, 2.5); // Make anchor a lot bigger
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; // Reduced lineWidth relative to scale
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(0, 10); // Shank
      ctx.moveTo(-7, 5); ctx.quadraticCurveTo(0, 12, 7, 5); // Arms
      ctx.moveTo(-4, -6); ctx.lineTo(4, -6); // Stock
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -12, 3, 0, Math.PI * 2); ctx.stroke(); // Ring
      ctx.restore();

      ctx.restore();

       // Render Catenary Chain
       if (catenaryPoints && catenaryPoints.length > 1) {
            const sternLeft = sternAttachX < anchorX;
            const chainLen = r.sternChainLengthCm;
            
            let accumulatedLen = 0;
            let currentPathType = 'chain'; // Start from ANCHOR (Chain) or BOAT (Rope)?
            // solveCatenary(0, boatElev, dx, 0).
            // P1 (0, boatElev) is BOAT. P2 (dx, 0) is ANCHOR.
            // So catenaryPoints[0] is Boat. 
            // The user has chain at ANCHOR connected to Rope at BOAT?
            // "Ankarlina" usually: Anchor -> Chain -> Rope -> Boat.
            // So points near End (Anchor) are Chain. Points near Start (Boat) are Rope.
            // We iterate from Start (Boat) -> End (Anchor).
            // So TotalLen - distAlong = distance from Anchor.
            // If (TotalLen - distAlong) < ChainLen -> Chain.
            // Else -> Rope.
            
            // First calculate total visual length of curved points to map precisely?
            // Or just use the 't' ratio from catenary generator if available? 
            // We don't have 't' here. Simple euclidean sum.
            let totalCurveLen = 0;
            for(let k=0; k<catenaryPoints.length-1; k++) {
                const dx = catenaryPoints[k+1].x - catenaryPoints[k].x;
                const dy = catenaryPoints[k+1].y - catenaryPoints[k].y;
                totalCurveLen += Math.sqrt(dx*dx + dy*dy);
            }
            
            // Draw Rope (Boat side) - STRAIGHT LINE (No Catenary Effect)
            ctx.beginPath();
            ctx.strokeStyle = '#2563eb'; // Blue Rope
            ctx.lineWidth = 3;
            
            let drawnRope = false;
            
            // Helper to get Screen Point
            const getPt = (p) => {
                 const sx = sternLeft ? (sternAttachX + p.x) : (sternAttachX - p.x);
                 const sy = Math.min(seaY, seaY - p.y);
                 return {x: sx, y: sy};
            };
            
            const ropeLimit = r.sternRopeLengthCm;
            
            // Find transition point (Rope -> Chain)
            let transitionPt = null;
            let lenSearch = 0;
            
            for(let i=0; i<catenaryPoints.length-1; i++) {
                 const p1 = catenaryPoints[i];
                 const p2 = catenaryPoints[i+1];
                 const segLen = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                 
                 if (lenSearch + segLen >= ropeLimit) {
                     // Found segment containing transition
                     const remaining = ropeLimit - lenSearch;
                     const t = remaining / segLen;
                     transitionPt = {
                         x: p1.x + (p2.x - p1.x) * t,
                         y: p1.y + (p2.y - p1.y) * t
                     };
                     break;
                 }
                 lenSearch += segLen;
            }
            
            // If rope is longer than entire curve (e.g. totally slack/on bottom?), fallback to end
            if (!transitionPt) {
                 transitionPt = catenaryPoints[catenaryPoints.length-1];
            }
            
            // Draw Straight Rope
            const pStart = getPt(catenaryPoints[0]); // Boat
            const pTransition = getPt(transitionPt); // Chain Start
            
            ctx.moveTo(pStart.x, pStart.y);
            ctx.lineTo(pTransition.x, pTransition.y);
            ctx.stroke();
            
            // Draw Chain part (Links) from Transition Point
            ctx.beginPath();
            ctx.strokeStyle = '#334155'; 
            ctx.lineWidth = 1.5; 
            
            // Start chain exactly at transition
            // We need to re-scan to find where to start drawing links
            let len = 0;
            let chainStarted = false;
             
            // Iterate again to draw chain links
            for(let i=0; i<catenaryPoints.length-1; i++) {
                 const p1 = catenaryPoints[i];
                 const p2 = catenaryPoints[i+1];
                 const segLen = Math.sqrt(Math.pow(p2.x-p1.x, 2) + Math.pow(p2.y-p1.y, 2));
                 const ropeLimit = r.sternRopeLengthCm;
                 
                 // If this segment is part of the chain (past rope limit)
                 if (len + segLen > ropeLimit) {
                      const s1 = getPt(p1);
                      const s2 = getPt(p2);
                      
                      // Calculate sub-steps for links
                      const linkDist = 10; 
                      const dist = Math.hypot(s2.x - s1.x, s2.y - s1.y);
                      const steps = Math.max(1, Math.floor(dist / linkDist));
                      const angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);

                      for(let k=0; k<steps; k++) {
                          const t = k/steps;
                          // If we are in the transition segment, ensure we don't draw links on the rope part
                          const currentDistOnLine = len + (segLen * t);
                          if (currentDistOnLine > ropeLimit) {
                              const lx = s1.x + (s2.x - s1.x)*t;
                              const ly = s1.y + (s2.y - s1.y)*t;
                              
                              ctx.save();
                              ctx.translate(lx, ly);
                              ctx.rotate(angle);
                              ctx.beginPath();
                              // Draw Link
                              ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI*2);
                              ctx.stroke();
                              ctx.restore();
                          }
                      }
                 }
                 len += segLen;
            }

       } else {
            // Fallback
       }

      // Bow Rope (Simple Curve)
      ctx.lineWidth = 2.5; 
      ctx.beginPath(); 
      ctx.moveTo(bowAttachX, bowAttachY);
      
      const dF_draw = Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2));
      const slackF = Math.max(0, r.bowRopeLengthCm - dF_draw);
      
      if (fTaut && r.windDir === 1 && !r.isSunk) {
        ctx.strokeStyle = fCritical ? '#ef4444' : '#f97316'; 
        ctx.lineTo(dockX, dockY); 
      } else {
        ctx.strokeStyle = '#fbbf24';
        // Simple slack curve
        const midXF = (bowAttachX + dockX) / 2;
        // Hang down proportional to slack
        const midYF = ((bowAttachY + dockY) / 2) + (slackF * 0.5);
        ctx.quadraticCurveTo(midXF, midYF, dockX, dockY);
      }
      ctx.stroke();

      // Vattenfärg: Blå (14, 165, 233) -> Grönaktig (20, 184, 166) vid storm
      const wA = 0.2; ctx.fillStyle = `rgba(14, 165, 233, ${wA})`;
      [30, -20].forEach((o, idx) => {
        ctx.beginPath(); ctx.moveTo(0, dimensions.height);
        for (let i = 0; i <= dimensions.width; i++) ctx.lineTo(i, curY + o + Math.sin(i * WAVE_K + r.wavePhase + idx) * (currentAmp * 0.7));
        ctx.lineTo(dimensions.width, dimensions.height); ctx.fill();
      });
      drawBoat(ctx, boatXAbs, boatFinalY - 4, totalAngle, bState, currentWind, r.boatLengthCm);
      ctx.beginPath(); ctx.moveTo(0, dimensions.height);
      for (let i = 0; i <= dimensions.width; i++) ctx.lineTo(i, curY + Math.sin(i * WAVE_K + r.wavePhase) * currentAmp);
      ctx.lineTo(dimensions.width, dimensions.height); ctx.fillStyle = `rgba(14, 165, 233, ${wA})`; ctx.fill();

      ctx.save(); ctx.translate(120, 160); 
      ctx.fillStyle = '#0f172a'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'right';
      const windTxt = `${trans.hudWind}: ${Math.abs(currentWind).toFixed(1)} m/s`;
      const waterTxt = `${trans.hudWater}: ${r.waterLevelCm} cm`;
      const waveTxt = `${trans.hudWaves}: ${r.waveHeightCm} cm`;
      const dockTxt = `${trans.hudDock}: ${r.isFloatingDock ? 'Flyt' : r.dockHeightCm + ' cm'}`;
      ctx.fillText(windTxt, 0, -40); ctx.fillText(waterTxt, 0, -25); ctx.fillText(waveTxt, 0, -10); ctx.fillText(dockTxt, 0, 5); 
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; const arrowX = currentWind * 3; ctx.translate(90, -45); 
      if (currentWind >= 0) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(arrowX, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(arrowX, 0); ctx.lineTo(arrowX - 8, -4); ctx.lineTo(arrowX - 8, 4); ctx.fill(); } 
      else { ctx.beginPath(); ctx.moveTo(Math.abs(arrowX), 0); ctx.lineTo(0, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4); ctx.fill(); }
      ctx.restore();

      drawDebugBox(ctx, r.debugData, trans);

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions, isSunk, language]);

  const drawDebugBox = (ctx, debugData, labels) => {
    const boxWidth = 240; // Wider for more info
    const x = (dimensions.width / 2) - (boxWidth / 2);
    const y = 80;
    const h = 130; // Taller
    
    ctx.save(); ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1;
    ctx.fillRect(x, y, boxWidth, h); ctx.strokeRect(x, y, boxWidth, h);
    
    ctx.fillStyle = '#ffffff'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(labels.debugTitle, x + 10, y + 15);
    
    // Stern
    const sternP = (debugData.sternDist / debugData.sternMax) * 100;
    ctx.fillStyle = sternP > 99.9 ? '#f87171' : '#a7f3d0';
    ctx.fillText(`${labels.debugStern}: ${debugData.sternDist.toFixed(0)} / ${debugData.sternMax.toFixed(0)} cm`, x + 10, y + 35);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(` -> ${labels.debugForce}: ${debugData.sternTension ? debugData.sternTension.toFixed(1) : 0} N`, x + 20, y + 47);

    // Bow
    const frontP = (debugData.frontDist / debugData.frontMax) * 100;
    ctx.fillStyle = frontP > 99.9 ? '#f87171' : '#a7f3d0';
    ctx.fillText(`${labels.debugBow}:   ${debugData.frontDist.toFixed(0)} / ${debugData.frontMax.toFixed(0)} cm`, x + 10, y + 65);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(` -> ${labels.debugForce}: ${debugData.frontTension ? debugData.frontTension.toFixed(1) : 0} N`, x + 20, y + 77);

    // Forces
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`${labels.debugWind}:   ${debugData.windForce ? debugData.windForce.toFixed(1) : 0} N`, x + 10, y + 95);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${labels.debugTotal}:  ${debugData.totalForce ? debugData.totalForce.toFixed(1) : 0} N`, x + 10, y + 115);

    ctx.restore();
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