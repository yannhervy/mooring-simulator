import React, { useEffect, useRef, useState } from 'react';
import SimulatorControls from './components/SimulatorControls';
import { translations as t } from './translations';

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
      let boatXAbs, boatFinalY, totalAngle, bState;
      let sternAttachX, sternAttachY, bowAttachX, bowAttachY;
      let sTaut, fTaut, fCritical;
      let distS = 0, distF = 0;
      
      const halfL = r.boatLengthCm / 2;
      const boatHeight = r.boatLengthCm * 0.3;
      const deckHeightOffset = boatHeight / 2;

      const maxSternStretch = r.sternChainLengthCm + (r.sternRopeLengthCm * 1.03); 
      const maxFrontStretch = r.bowRopeLengthCm * 1.30; 

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
        // Wind force scales with boat size (Windage) and Wind Speed ^ 1.8
        const mass = (r.boatLengthCm * 1.6); 
        const windageFactor = r.boatLengthCm / 50; 
        const windForce = Math.sign(currentWind) * Math.pow(Math.abs(currentWind), 1.8) * 20.0 * windageFactor;
        
        // Resistance (Water Drag + Chain Drag on bottom)
        // Base resistance
        // Create velocity state if it doesn't exist
        if (typeof r.boatVX === 'undefined') r.boatVX = 0;

        // Force Accumulator
        let forceX = 0;

        // 1. Wind Force
        forceX += windForce;

        // 2. Water Drag (Velocity based)
        // Drag equation: Fd = -0.5 * rho * A * v*v * Cd * sign(v)
        // Simply: Fd = -k * v * |v|
        // Or linear drag for low speeds: Fd = -k * v
        const dragCoeff = 15.0 + (r.boatLengthCm * 0.1); 
        forceX -= r.boatVX * dragCoeff; 

        // 3. Chain Drag (if moving and chain is slack)
        // If extension is low, we assume chain is dragging on seabed -> higher friction
        // We use the previously calculated extensionRatio or distToAnchor
        const currentBoatXAbs = (dimensions.width / 2) + r.boatX;
        const currentSternX = currentBoatXAbs - halfL;
        const currentBowX = currentBoatXAbs + halfL;
        const maxSternReach = r.sternChainLengthCm + r.sternRopeLengthCm;
        const physDxS = Math.abs(currentSternX - anchorX);
        const distToAnchor = Math.hypot(physDxS, Math.abs(seaY - (curY - deckHeightOffset)));
        
        let sternTensionX = 0;
        if (maxSternReach > 0) {
           // Clamp max extension to 0.95 to prevent infinity explosion
           const extensionRatio = Math.min(0.95, distToAnchor / maxSternReach);
           
           if (extensionRatio < 0.8) {
               // Extra drag from dragging heavy chain
               forceX -= r.boatVX * (chainW * (1.0 - extensionRatio) * 10.0);
           }

           // Catenary Tension
           const chainWeightTotal = (chainW * r.sternChainLengthCm) + (ROPE_WEIGHT_PER_M * r.sternRopeLengthCm);
           const tensionForce = chainWeightTotal * (Math.pow(extensionRatio, 2) / (1 - extensionRatio)) * 4.0;
           
           const angle = Math.atan2(seaY - (curY - deckHeightOffset), physDxS); 
           sternTensionX = tensionForce * Math.cos(angle);
        }

        // 4. Bow Tension
        let bowTensionX = 0;
        const distToDock = Math.hypot(Math.abs(currentBowX - dockX), Math.abs(dockY - (curY - deckHeightOffset)));
        if (r.bowRopeLengthCm > 0) {
             const bowRatio = Math.min(0.95, distToDock / r.bowRopeLengthCm);
             if (bowRatio > 0.8) {
                 // Spring-like for rope
                 bowTensionX = (bowRatio / (1 - bowRatio)) * 500;
             }
        }

        const sternForceSign = currentSternX > anchorX ? -1 : 1;
        const bowForceSign = currentBowX < dockX ? 1 : -1;
        
        forceX += (sternTensionX * sternForceSign);
        forceX += (bowTensionX * bowForceSign);

        // Integration (Euler)
        // F = ma -> a = F/m
        const accelX = forceX / mass;
        r.boatVX += accelX * 0.05; // dt = 0.05 (approx)
        
        // Velocity Damping (Artifical stability)
        r.boatVX *= 0.98; 

        // Update Position
        r.boatX += r.boatVX;

        // Visual "jitter" fix: if velocity is tiny, snap to 0 to prevent micro-oscillations
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

        // Restore totalAngle calculation (was missing)
        totalAngle = waveAngle + tiltAngle;
        
        // Flatten wave impact for heavy boats (reduced vertical bobbing)
        if (r.boatLengthCm > 300) {
            totalAngle *= 0.5; 
        }

        // --- GEOMETRIC SOLVER ---
        // Calculate Bow and Stern Y positions independently based on constraints.
        
        // Define local offsets early
        const sxLocal = -halfL; const syLocal = -deckHeightOffset;
        const fxLocal = halfL; const fyLocal = -deckHeightOffset;
        
        // 1. Constants & Limits
        const keelOffset = r.boatLengthCm * 0.15; // Distance from center to keel (approx half height)
        const groundLimitY = seaY - keelOffset;    // Lowest point center can be before touching ground
        
        // 2. Estimate X positions (approximate with flat angle first)
        const estBowX = boatXAbs + halfL;
        const estSternX = boatXAbs - halfL;
        
        // 3. Calculate separate water levels for Bow/Stern (Wave Gradient)
        const bowNatY = curY + Math.sin(estBowX * WAVE_K + r.wavePhase) * currentAmp;
        const sternNatY = curY + Math.sin(estSternX * WAVE_K + r.wavePhase) * currentAmp;
        
        // 4. Solve Bow Y
        // Start with Water Level
        let newBowY = bowNatY;
        
        // Constraint A: Ground (Cannot go deeper than ground)
        // BowY is Center-Y equivalent. Center cannot be lower than GroundLimit.
        // (Actually assuming flat bottom simplicity).
        if (newBowY > groundLimitY) newBowY = groundLimitY;
        
        // Constraint B: Rope Limits (Circle around Dock)
        const dxF = Math.abs(estBowX - dockX);
        const maxRopeF = r.bowRopeLengthCm * 1.05; // 5% stretch allowance
        if (dxF < maxRopeF) {
            const maxDyF = Math.sqrt(Math.pow(maxRopeF, 2) - Math.pow(dxF, 2));
            const ropeLimitBottom = dockY + maxDyF + deckHeightOffset; 
            const ropeLimitTop = dockY - maxDyF + deckHeightOffset;
            
            // Hanging Check (Falling)
            if (newBowY > ropeLimitBottom) newBowY = ropeLimitBottom;
            
            // Submersion Check (Rising)
            if (newBowY < ropeLimitTop) newBowY = ropeLimitTop;
        }

        // 5. Solve Stern Y
        let newSternY = sternNatY;
        
        // Constraint A: Ground
        if (newSternY > groundLimitY) newSternY = groundLimitY;
        
        // Constraint B: Rope Limits (Stern Anchor)
        const dxS = Math.abs(estSternX - anchorX);
        const maxRopeS = r.sternChainLengthCm + r.sternRopeLengthCm; // Max reach
        if (dxS < maxRopeS) {
             // Basic limit (max reach) - simplified for chain sag
             const maxDyS = Math.sqrt(Math.pow(maxRopeS, 2) - Math.pow(dxS, 2));
             const anchorLimitBottom = seaY + maxDyS + deckHeightOffset;
             const anchorLimitTop = seaY - maxDyS + deckHeightOffset;
             
             if (newSternY > anchorLimitBottom) newSternY = anchorLimitBottom;
             if (newSternY < anchorLimitTop) newSternY = anchorLimitTop;
        }
        
        // 6. Resolve Boat Position & Angle
        // Calculate angle from the difference in Y
        const dy = newSternY - newBowY;
        const sinAngle = dy / r.boatLengthCm;
        const clampedSin = Math.max(-0.9, Math.min(0.9, sinAngle)); // Prevent math errors
        totalAngle = Math.asin(clampedSin);
        
        // Recalculate Center Y
        boatFinalY = (newBowY + newSternY) / 2;

        // Flatten extremely steep angles for visual sanity
        if (Math.abs(totalAngle) > 0.5) totalAngle *= 0.8;
                
        // Recalculate Attach Points with final Angle
        const cosA = Math.cos(totalAngle); const sinA = Math.sin(totalAngle);
        
        sternAttachX = boatXAbs + (sxLocal * cosA - syLocal * sinA);
        sternAttachY = boatFinalY + (sxLocal * sinA + syLocal * cosA);
        bowAttachX = boatXAbs + (fxLocal * cosA - fyLocal * sinA);
        bowAttachY = boatFinalY + (fxLocal * sinA + fyLocal * cosA);
        
        
        distS = Math.sqrt(Math.pow(sternAttachX - anchorX, 2) + Math.pow(sternAttachY - seaY, 2));
        distF = Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2));
        
        sTaut = distS >= maxSternStretch - 1;
        fTaut = distF >= r.bowRopeLengthCm; 
        fCritical = distF >= maxFrontStretch - 0.5; 
        const isColl = boatXAbs + halfL >= dockX - 1;

        bState = 'normal';
        const forcedDepth = boatFinalY - curY; 
        // Sunk if pulled deep underwater, but NOT if just "no water" (grounded)
        // Only sunk if forcedDepth > 5 AND ropes are tight (pulling it down even deeper than normal float)
        // If "no water", forcedDepth is huge (curY is deep). This shouldn't trigger sunk.
        // We only care if rope pulls boat BELOW its natural float line (BowNatY) signifcantly.
        
        // Better Sunk Check:
        // If newBowY < (bowNatY - 5), it means rope is pulling bow under.
        // If newSternY < (sternNatY - 5), rope pulling stern under.
        if ((newBowY > bowNatY + 5) || (newSternY > sternNatY + 5)) { // Note: Y increases down. Larger Y = Deeper.
             // Rope forces Y to be LARGER (deeper).
             r.isSunk = true; bState = 'sunk';
        }
        else if (fCritical && r.windDir === 1) bState = 'critical';
        else if (isColl) bState = 'colliding'; 
        else {
             // Calculate true stretch ratios based o Euclidean distance
             const sternRatio = distS / maxSternStretch;
             
             // Only show stress if lines are actually TIGHT (near 100% capacity)
             // Chain needs to be fully lifted (straight) to be "taut" in this context
             const sTautReal = sternRatio > 0.98;
             const fTautReal = (distF / r.bowRopeLengthCm) > 0.98;

             if ((sTautReal && r.windDir === -1) || (fTautReal && r.windDir === 1)) {
                 bState = 'stressed';
             }
        }

        r.isColliding = isColl;
        r.debugData = { sternDist: distS, sternMax: maxSternStretch, frontDist: distF, frontMax: maxFrontStretch };
      }

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

      const slackS = Math.max(0, maxSternStretch - distS);
      const sagS = sTaut && !r.isSunk ? 0 : Math.min(slackS * 0.9, effectiveSagWeight * 15 + slackS * 0.3);
      const cpX = (sternAttachX + anchorX) / 2;
      const cpY = Math.max(sternAttachY, seaY) + sagS; 
      let lX = sternAttachX; let lY = sternAttachY;
      for(let i = 1; i <= 100; i++) {
        const t = i / 100;
        const px = Math.pow(1-t,2)*sternAttachX + 2*(1-t)*t*cpX + Math.pow(t,2)*anchorX;
        const py = Math.pow(1-t,2)*sternAttachY + 2*(1-t)*t*cpY + Math.pow(t,2)*seaY;
        const cY = Math.min(py, seaY);
        if ((t * totStern) <= r.sternRopeLengthCm) {
          ctx.beginPath(); ctx.moveTo(lX, lY); ctx.lineTo(px, cY); ctx.strokeStyle = (sTaut && r.windDir === -1 && !r.isSunk) ? '#2563eb' : '#1e3a8a'; ctx.lineWidth = 3; ctx.stroke();
        } else if (i % 3 === 0) {
          ctx.save(); ctx.translate(px, cY); ctx.rotate(Math.atan2(cY-lY, px-lX)); ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0,0,5,2.5,0,0,6.3); ctx.stroke(); ctx.restore();
        }
        lX = px; lY = cY;
      }

      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bowAttachX, bowAttachY);
      if (fTaut && r.windDir === 1 && !r.isSunk) {
        ctx.strokeStyle = fCritical ? '#ef4444' : '#f97316'; ctx.lineTo(dockX, dockY); 
      } else {
        ctx.strokeStyle = '#fbbf24';
        const dF_draw = Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2));
        const slackF = Math.max(0, r.bowRopeLengthCm - dF_draw);
        const midXF = (bowAttachX + dockX) / 2;
        const midYF = Math.max(bowAttachY, dockY) + (slackF * 0.7);
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
    const boxWidth = 190;
    const x = (dimensions.width / 2) - (boxWidth / 2);
    const y = 80;
    ctx.save(); ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1;
    ctx.fillRect(x, y, 190, 70); ctx.strokeRect(x, y, 190, 70);
    ctx.fillStyle = '#ffffff'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(labels.debugTitle, x + 10, y + 15);
    const sternP = (debugData.sternDist / debugData.sternMax) * 100;
    ctx.fillStyle = sternP > 99.9 ? '#f87171' : '#a7f3d0';
    ctx.fillText(`${labels.debugStern}: ${debugData.sternDist.toFixed(0)} / ${debugData.sternMax.toFixed(0)} cm`, x + 10, y + 35);
    const frontP = (debugData.frontDist / debugData.frontMax) * 100;
    ctx.fillStyle = frontP > 99.9 ? '#f87171' : '#a7f3d0';
    ctx.fillText(`${labels.debugBow}:   ${debugData.frontDist.toFixed(0)} / ${debugData.frontMax.toFixed(0)} cm`, x + 10, y + 55);
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