import React, { useEffect, useRef, useState } from 'react';

/**
 * Stegerholmens Småbåtshamn - Simulator v10.3 (Skala 1px = 1cm).
 * * En avancerad simulator för förtöjningsfysik med:
 * - Hård positionslåsning (Hard Clamp) för tampar och kätting.
 * - Materialegenskaper (0% kättingstretch, 3% ankartamp, 10% förtamp).
 * - Dynamiskt väder: Solen och molnen styrs av vindstyrkan.
 * - Flexibelt UI: Justerbar båtlängd, brygghöjd och valbar flytbrygga.
 * - Tvåspråkigt stöd (SV/EN).
 */

const App = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // --- STATE ---
  const [language, setLanguage] = useState('sv'); 
  const [waterLevelCm, setWaterLevelCm] = useState(0); 
  const [depthCm, setDepthCm] = useState(100); 
  const [amplitude, setAmplitude] = useState(10); 
  const [dockHeightCm, setDockHeightCm] = useState(200); 
  const [isFloatingDock, setIsFloatingDock] = useState(false);
  const [sternRopePart, setSternRopePart] = useState(400);   
  const [sternChainPart, setSternChainPart] = useState(400); 
  const [frontRopeLength, setFrontRopeLength] = useState(150); 
  const [anchorOffset, setAnchorOffset] = useState(600);
  const [boatLengthCm, setBoatLengthCm] = useState(60); 
  const [baseWind, setBaseWind] = useState(5); 
  const [windDirection, setWindDirection] = useState(-1); 
  const [chainThickness, setChainThickness] = useState(10); 
  const [weatherMode, setWeatherMode] = useState('NORMAL');
  
  // Använd detta state för att styra UI (disabled inputs etc)
  const [isSunkState, setIsSunkState] = useState(false); 

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // --- FYSIK KONSTANTER ---
  const calculateWeight = (d) => 0.0225 * Math.pow(d, 2);
  const ROPE_WEIGHT_PER_M = 0.5;
  const WAVE_SPEED_CM_S = 100; 
  const WAVE_LENGTH_CM = 600;  
  const WAVE_K = (2 * Math.PI) / WAVE_LENGTH_CM; 

  // --- ÖVERSÄTTNINGAR ---
  const t = {
    sv: {
      title: "Stegerholmens Hamnkontroll",
      mainTitle: "Stegerholmens Småbåtshamn",
      weatherLabel: "VÄDERLEK",
      modes: { OFF: 'AV', NORMAL: 'NORMAL', EXTREME: 'EXTREM' },
      waterLevel: "Vattennivå",
      depth: "Djup (Sjöbotten)",
      dockHeight: "Brygghöjd (från botten)",
      floatingDock: "Flytbrygga",
      boatLength: "Båtlängd",
      waveHeight: "Våghöjd",
      windSpeed: "Vindstyrka (Bas)",
      fromDock: "FRÅN BRYGGA",
      fromSea: "FRÅN HAVET",
      ropeLength: "Tamplängd (Blå)",
      chainLength: "Kättinglängd (Svart)",
      thickness: "Godstjocklek",
      anchorPos: "Ankarposition (X)",
      bowLine: "Förtamp",
      hudWind: "Vind",
      hudWater: "Vatten",
      hudWaves: "Vågor",
      hudDock: "Brygga",
      debugTitle: "DEBUG: FÖRTÖJNINGSDATA",
      debugStern: "AKTER",
      debugBow: "FÖR"
    },
    en: {
      title: "Stegerholmen Harbor Control",
      mainTitle: "Stegerholmen Marina",
      weatherLabel: "WEATHER",
      modes: { OFF: 'OFF', NORMAL: 'NORMAL', EXTREME: 'EXTREME' },
      waterLevel: "Water Level",
      depth: "Depth (Seabed)",
      dockHeight: "Dock Height (from seabed)",
      floatingDock: "Floating Dock",
      boatLength: "Boat Length",
      waveHeight: "Wave Height",
      windSpeed: "Wind Speed (Waves)",
      fromDock: "FROM DOCK",
      fromSea: "FROM SEA",
      ropeLength: "Rope Length (Blue)",
      chainLength: "Chain Length (Black)",
      thickness: "Chain Thickness",
      anchorPos: "Anchor Pos (X)",
      bowLine: "Bow Line",
      hudWind: "Wind",
      hudWater: "Water",
      hudWaves: "Waves",
      hudDock: "Dock",
      debugTitle: "DEBUG: MOORING DATA",
      debugStern: "STERN",
      debugBow: "BOW"
    }
  };

  const txt = t[language];

  // Ref för molngrafik
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

  // Huvudref för animationsdata (förhindrar frame-drops vid re-renders)
  const refs = useRef({
    waterLevel: 0, depth: 100, dockHeight: 200, amplitude: 10, 
    sternChain: 400, sternRope: 400, frontLength: 150, anchorOffset: 600, 
    boatLength: 60, wind: 5, windDir: -1, thickness: 10, 
    boatX: 0, sinkingY: 0, isSunk: false, isColliding: false, wavePhase: 0,
    lang: 'sv', isFloatingDock: false,
    debugData: { sternDist: 0, sternMax: 0, frontDist: 0, frontMax: 0 }
  });

  // Synka UI-state till animationsref
  useEffect(() => {
    // Återställning vid manuell ändring
    if (weatherMode === 'OFF' && refs.current.isSunk) {
         refs.current.isSunk = false;
         refs.current.sinkingY = 0;
         setIsSunkState(false);
    }

    refs.current = {
      ...refs.current,
      waterLevel: waterLevelCm, depth: depthCm, dockHeight: dockHeightCm, amplitude, 
      sternChain: sternChainPart, sternRope: sternRopePart, frontLength: frontRopeLength, 
      anchorOffset, boatLength: boatLengthCm, wind: baseWind, windDir: windDirection, 
      thickness: chainThickness, isSunk: isSunkState, isFloatingDock, lang: language
    };
  }, [waterLevelCm, depthCm, dockHeightCm, amplitude, sternChainPart, sternRopePart, frontRopeLength, anchorOffset, boatLengthCm, baseWind, windDirection, chainThickness, isSunkState, isFloatingDock, language, weatherMode]);

  // Automatiskt Väder Loop
  useEffect(() => {
    let interval;
    if (weatherMode !== 'OFF') {
        let time = 0;
        interval = setInterval(() => {
            time += 0.02; 
            let newWater = 0; let windVal = 0;
            if (weatherMode === 'NORMAL') {
                newWater = Math.round(25 + 55 * Math.sin(time * 0.1));
                windVal = 21 * (Math.sin(time * 0.15) * 0.6 + Math.sin(time * 0.4) * 0.4);
            } else if (weatherMode === 'EXTREME') {
                newWater = Math.round(35 + 135 * Math.sin(time * 0.08));
                windVal = 30 * (Math.sin(time * 0.12) * 0.7 + Math.sin(time * 0.5) * 0.3);
            }
            const absWind = Math.round(Math.abs(windVal));
            setWaterLevelCm(newWater);
            setBaseWind(absWind);
            setWindDirection(windVal >= 0 ? 1 : -1);
            setAmplitude(Math.max(5, Math.round(absWind * 2.5)));
            
            // Återställ sjunkstatus om vi byter väderläge
            if (refs.current.isSunk) {
                refs.current.isSunk = false;
                refs.current.sinkingY = 0;
                setIsSunkState(false);
            }
        }, 50); 
    }
    return () => clearInterval(interval);
  }, [weatherMode]);

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

  // --- RIT-FUNKTIONER ---

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
      const h = length * 0.3;
      const verticalOffset = -h / 2; // Origo (y) är vattenlinjen, hälften under

      // Skrov
      ctx.fillStyle = state === 'colliding' || state === 'critical' || state === 'sunk' ? '#ef4444' : (state === 'stressed' ? '#fca5a5' : '#ffffff');
      ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 4;
      ctx.beginPath(); 
      ctx.moveTo(-halfL, verticalOffset); 
      ctx.lineTo(halfL, verticalOffset); 
      ctx.lineTo(halfL - (length*0.13), verticalOffset + h); 
      ctx.lineTo(-halfL + (length*0.13), verticalOffset + h); 
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
      ctx.closePath(); ctx.fill();

      // "S" på seglet
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

    const drawRulers = (ctx, seaY, curY, dockX, anchorX) => {
      ctx.save();
      // Djup-linjal (Vertikal)
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.2)'; ctx.fillStyle = 'rgba(15, 23, 42, 0.5)'; ctx.font = '10px monospace';
      for (let y = seaY; y > 0; y -= 100) { 
        ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(25, y); ctx.stroke(); 
        ctx.fillText(`${Math.round(seaY-y)/100}m`, 15, y+4); 
      }
      // Vattennivå-indikator (Pilen till vänster)
      ctx.fillStyle = '#0ea5e9'; ctx.beginPath();
      ctx.moveTo(40, curY); ctx.lineTo(32, curY - 5); ctx.lineTo(32, curY + 5); ctx.fill();

      // Botten-linjal (Horisontell)
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.3)'; ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.beginPath(); ctx.moveTo(0, seaY); ctx.lineTo(dimensions.width, seaY); ctx.stroke();
      for (let x = 0; x <= dimensions.width; x += 10) {
        const dist = Math.round(dockX - x); 
        if (dist % 100 === 0) {
          ctx.beginPath(); ctx.moveTo(x, seaY); ctx.lineTo(x, seaY + 15); ctx.stroke();
          ctx.fillText(`${(dist / 100).toFixed(0)}m`, x, seaY + 28);
        } else if (dist % 50 === 0) {
          ctx.beginPath(); ctx.moveTo(x, seaY); ctx.lineTo(x, seaY + 8); ctx.stroke();
        }
      }
      // Ankarmarkering & Bojring
      ctx.fillStyle = '#10b981'; ctx.textAlign = 'center'; ctx.fillText(`ANKAR`, anchorX, seaY + 40);
      ctx.beginPath(); ctx.arc(anchorX, seaY, 6, 0, Math.PI * 2); ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'white'; ctx.fill();
      ctx.restore();
    };

    const drawDebugBox = (ctx, debugData, labels) => {
        // Placerad nere till vänster
        const x = 20; const y = dimensions.height - 110;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1;
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

    const animate = () => {
      time += 0.02;
      const r = refs.current;
      const chainW = calculateWeight(r.thickness);
      const totStern = r.sternChain + r.sternRope;
      const effectiveSagWeight = totStern > 0 ? ((chainW * r.sternChain) + (ROPE_WEIGHT_PER_M * r.sternRope)) / totStern : chainW;
      
      const currentAmp = r.amplitude * (1 + 0.2 * Math.sin(time * 0.7));
      r.wavePhase -= (WAVE_SPEED_CM_S / 60) * WAVE_K * r.windDir; 

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // --- VÄDERGRAFIK ---
      const windFactor = Math.min(1, Math.abs(r.wind) / 20); 
      const rSky = 186 - (115 * windFactor);
      const gSky = 230 - (145 * windFactor);
      const bSky = 253 - (148 * windFactor);
      ctx.fillStyle = `rgb(${rSky},${gSky},${bSky})`;
      ctx.fillRect(0,0, dimensions.width, dimensions.height); 
      
      const b0Y = dimensions.height * 0.6; 
      const curY = b0Y - r.waterLevel;
      const seaY = b0Y + r.depth; 
      const dockX = (dimensions.width / 2) + 120;
      const anchorX = (dimensions.width / 2) - r.anchorOffset;
      const currentWind = r.wind * (1 + (Math.sin(time * 0.45) * 0.35 + 0.35)) * r.windDir;

      let dockY;
      if (r.isFloatingDock) {
        const dockWaveOffset = Math.sin(dockX * WAVE_K + r.wavePhase) * currentAmp;
        dockY = curY + dockWaveOffset - 15; 
      } else {
        dockY = seaY - r.dockHeight; 
      }

      // Solen (centrerad uppe)
      const sunOpacity = Math.max(0, 1 - (windFactor * 1.2));
      if (sunOpacity > 0) {
        ctx.save(); ctx.globalAlpha = sunOpacity; ctx.translate(dimensions.width / 2, 80);
        const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, 60);
        grad.addColorStop(0, 'rgba(255, 220, 0, 0.5)'); grad.addColorStop(1, 'rgba(255, 220, 0, 0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Moln (fler vid blåst)
      const cloudColorVal = 255 - (100 * windFactor); 
      const cloudColor = `rgba(${cloudColorVal}, ${cloudColorVal}, ${cloudColorVal}, 0.8)`;
      const visibleCloudsCount = 3 + Math.floor(windFactor * 5); 
      cloudsRef.current.forEach((c, idx) => {
        if (idx < visibleCloudsCount) {
            c.x += currentWind * c.speedFactor;
            if (c.x > dimensions.width + 100) c.x = -100;
            if (c.x < -100) c.x = dimensions.width + 100;
            ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.scale, c.scale); ctx.fillStyle = cloudColor;
            ctx.beginPath(); ctx.arc(0, 0, 20, 0, 6.3); ctx.arc(15, -10, 25, 0, 6.3); ctx.arc(40, 0, 20, 0, 6.3); ctx.arc(20, 10, 20, 0, 6.3); ctx.fill(); ctx.restore();
        }
      });

      // --- LOGIK & FYSIK ---
      let boatXAbs, boatFinalY, totalAngle, bState;
      let sternAttachX, sternAttachY, bowAttachX, bowAttachY;
      let sTaut, fTaut, fCritical;
      let distS = 0, distF = 0;
      
      const halfL = r.boatLength / 2;
      const deckOffset = (r.boatLength * 0.3) / 2;
      const maxSternStretch = r.sternChain + (r.sternRope * 1.03); 
      const maxFrontStretch = r.frontLength * 1.10; 

      if (r.isSunk) {
        r.sinkingY += 0.5;
        boatXAbs = (dimensions.width / 2) + r.boatX;
        let maxSinkY = seaY - (halfL * 0.5); 
        let currentSinkY = (curY + r.sinkingY);
        if (currentSinkY >= maxSinkY) currentSinkY = maxSinkY;
        boatFinalY = currentSinkY;
        totalAngle = Math.PI / 12; bState = 'sunk';
        const cosA = Math.cos(totalAngle); const sinA = Math.sin(totalAngle);
        sternAttachX = boatXAbs + (-halfL * cosA - (-deckOffset) * sinA);
        sternAttachY = boatFinalY + (-halfL * sinA + (-deckOffset) * cosA);
        bowAttachX = boatXAbs + (halfL * cosA - (-deckOffset) * sinA);
        bowAttachY = boatFinalY + (halfL * sinA + (-deckOffset) * cosA);
        sTaut = false; fTaut = true; fCritical = true;
        distS = Math.sqrt(Math.pow(sternAttachX - anchorX, 2) + Math.pow(sternAttachY - seaY, 2));
        distF = Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2));
        r.debugData = { sternDist: distS, sternMax: maxSternStretch, frontDist: distF, frontMax: maxFrontStretch };
      } else {
        const windForce = Math.sign(currentWind) * Math.pow(Math.abs(currentWind), 1.8) * 0.55;
        const boatResistance = (chainW * 0.6) + 5.0 + (r.boatLength * 0.05); 
        r.boatX += ((windForce / boatResistance) - r.boatX) * 0.015;

        let tempBoatXAbs = (dimensions.width / 2) + r.boatX;
        let natY = curY + Math.sin(tempBoatXAbs * WAVE_K + r.wavePhase) * currentAmp;
        
        // Stabil Clamping (geometrisk begränsning)
        const attachY = natY - deckOffset;
        const dyF = Math.abs(attachY - dockY); const dyS = Math.abs(attachY - seaY);
        let allowedDxFront = dyF < maxFrontStretch ? Math.sqrt(Math.pow(maxFrontStretch, 2) - Math.pow(dyF, 2)) : 0;
        let allowedDxStern = dyS < maxSternStretch ? Math.sqrt(Math.pow(maxSternStretch, 2) - Math.pow(dyS, 2)) : 0;
        const minXF = dockX - allowedDxFront - halfL; const maxXF = dockX + allowedDxFront - halfL;
        const minXS = anchorX - allowedDxStern + halfL; const maxXS = anchorX + allowedDxStern + halfL;
        const finalMinX = Math.max(minXF, minXS); const finalMaxX = Math.min(maxXF, maxXS, dockX - halfL);
        if (finalMinX > finalMaxX) tempBoatXAbs = (finalMinX + finalMaxX) / 2;
        else { if (tempBoatXAbs < finalMinX) tempBoatXAbs = finalMinX; if (tempBoatXAbs > finalMaxX) tempBoatXAbs = finalMaxX; }
        boatXAbs = tempBoatXAbs; r.boatX = boatXAbs - (dimensions.width / 2);
        
        natY = curY + Math.sin(boatXAbs * WAVE_K + r.wavePhase) * currentAmp;
        const nextY = curY + Math.sin((boatXAbs+1) * WAVE_K + r.wavePhase) * currentAmp;
        const waveAngle = Math.atan2(nextY - natY, 1);
        let tiltAngle = (dyF > maxFrontStretch) ? Math.atan2(dockY + maxFrontStretch + deckOffset - natY, halfL) : 0;

        boatFinalY = natY;
        if (boatFinalY > seaY - (halfL * 0.5)) boatFinalY = seaY - (halfL * 0.5); 
        totalAngle = waveAngle + tiltAngle;
        
        const cosA = Math.cos(totalAngle); const sinA = Math.sin(totalAngle);
        sternAttachX = boatXAbs + (-halfL * cosA - (-deckOffset) * sinA);
        sternAttachY = boatFinalY + (-halfL * sinA + (-deckOffset) * cosA);
        bowAttachX = boatXAbs + (halfL * cosA - (-deckOffset) * sinA);
        bowAttachY = boatFinalY + (halfL * sinA + (-deckOffset) * cosA);

        distS = Math.sqrt(Math.pow(sternAttachX - anchorX, 2) + Math.pow(sternAttachY - seaY, 2));
        distF = Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2));
        sTaut = distS >= maxSternStretch - 1; fTaut = distF >= r.frontLength; 
        fCritical = distF >= maxFrontStretch - 0.5; const isColl = boatXAbs + halfL >= dockX - 1;
        bState = 'normal';
        const forcedDepth = boatFinalY - curY; 
        if (forcedDepth > 5 && (fCritical || sTaut)) { r.isSunk = true; setIsSunkState(true); bState = 'sunk'; }
        else if (fCritical && r.windDir === 1) bState = 'critical';
        else if (isColl) bState = 'colliding'; 
        else if (((sTaut && r.windDir === -1) || (fTaut && r.windDir === 1))) bState = 'stressed';
        r.isColliding = isColl;
        r.debugData = { sternDist: distS, sternMax: maxSternStretch, frontDist: distF, frontMax: maxFrontStretch };
      }

      // -- RENDERING --
      if (!r.isFloatingDock) {
        ctx.fillStyle = '#18181b'; 
        ctx.fillRect(dockX + 20, dockY, 12, Math.max(0, seaY - dockY));
        ctx.fillRect(dockX + 110, dockY, 12, Math.max(0, seaY - dockY));
      }
      ctx.fillStyle = '#451a03'; ctx.fillRect(dockX, dockY - 15, 150, 25);
      drawRulers(ctx, seaY, curY, dockX, anchorX);

      // Akterlina
      const slackS = Math.max(0, maxSternStretch - distS);
      const sagS = (sTaut && !r.isSunk) ? 0 : Math.min(slackS * 0.9, effectiveSagWeight * 15 + slackS * 0.3);
      const cpX = (sternAttachX + anchorX) / 2;
      const cpY = Math.max(sternAttachY, seaY) + sagS; 
      let lX = sternAttachX; let lY = sternAttachY;
      for(let i = 1; i <= 100; i++) {
        const t = i / 100;
        const px = Math.pow(1-t,2)*sternAttachX + 2*(1-t)*t*cpX + Math.pow(t,2)*anchorX;
        const py = Math.pow(1-t,2)*sternAttachY + 2*(1-t)*t*cpY + Math.pow(t,2)*seaY;
        const cY = Math.min(py, seaY);
        if ((t * totStern) <= r.sternRope) {
          ctx.beginPath(); ctx.moveTo(lX, lY); ctx.lineTo(px, cY); ctx.strokeStyle = (sTaut && r.windDir === -1 && !r.isSunk) ? '#2563eb' : '#1e3a8a'; ctx.lineWidth = 3; ctx.stroke();
        } else if (i % 3 === 0) {
          ctx.save(); ctx.translate(px, cY); ctx.rotate(Math.atan2(cY-lY, px-lX)); ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0,0,5,2.5,0,0,6.3); ctx.stroke(); ctx.restore();
        }
        lX = px; lY = cY;
      }

      // Förtamp
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bowAttachX, bowAttachY);
      if (fTaut && r.windDir === 1 && !r.isSunk) {
        ctx.strokeStyle = fCritical ? '#ef4444' : '#f97316'; ctx.lineTo(dockX, dockY); 
      } else {
        ctx.strokeStyle = '#fbbf24';
        const slackF = Math.max(0, r.frontLength - Math.sqrt(Math.pow(bowAttachX - dockX, 2) + Math.pow(bowAttachY - dockY, 2)));
        ctx.quadraticCurveTo((bowAttachX + dockX) / 2, Math.max(bowAttachY, dockY) + (slackF * 0.7), dockX, dockY);
      }
      ctx.stroke();

      // Vattenlager (bakgrund)
      const trans = t[r.lang] || t['sv'];
      const wA = 0.2; ctx.fillStyle = `rgba(14, 165, 233, ${wA})`;
      [30, -20].forEach((o, idx) => {
        ctx.beginPath(); ctx.moveTo(0, dimensions.height);
        for (let i = 0; i <= dimensions.width; i++) ctx.lineTo(i, curY + o + Math.sin(i * WAVE_K + r.wavePhase + idx) * (currentAmp * 0.7));
        ctx.lineTo(dimensions.width, dimensions.height); ctx.fill();
      });

      // Båten
      drawBoat(ctx, boatXAbs, boatFinalY, totalAngle, bState, currentWind, r.boatLength);

      // Vatten (förgrund)
      ctx.beginPath(); ctx.moveTo(0, dimensions.height);
      for (let i = 0; i <= dimensions.width; i++) ctx.lineTo(i, curY + Math.sin(i * WAVE_K + r.wavePhase) * currentAmp);
      ctx.lineTo(dimensions.width, dimensions.height); ctx.fillStyle = `rgba(14, 165, 233, ${wA})`; ctx.fill();

      // HUD & Vindpil
      ctx.save(); ctx.translate(120, 160); 
      ctx.fillStyle = '#0f172a'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'right';
      const windTxt = `${trans.hudWind}: ${Math.abs(currentWind).toFixed(1)} m/s`;
      const waterTxt = `${trans.hudWater}: ${r.waterLevel} cm`;
      const waveTxt = `${trans.hudWaves}: ${r.amplitude} cm`;
      const dockTxt = `${trans.hudDock}: ${r.isFloatingDock ? 'Flyt' : r.dockHeight + ' cm'}`;
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
  }, [dimensions, isSunkState, language]);

  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-full h-screen bg-slate-400 overflow-hidden font-sans text-white text-center">
      
      {/* KONTROLLPANEL */}
      <div className="absolute top-6 right-6 z-20 bg-slate-900/95 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-2xl w-80 max-h-[95vh] overflow-y-auto scrollbar-hide text-left">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-4">
          <h3 className="font-bold text-[10px] uppercase tracking-widest text-sky-400 italic">{txt.title}</h3>
          <div className="flex gap-1">
            <button onClick={() => setLanguage('sv')} className={`text-[9px] px-1 rounded ${language === 'sv' ? 'bg-sky-600 text-white' : 'text-slate-500'}`}>SV</button>
            <button onClick={() => setLanguage('en')} className={`text-[9px] px-1 rounded ${language === 'en' ? 'bg-sky-600 text-white' : 'text-slate-500'}`}>EN</button>
          </div>
        </div>
        
        <div className="space-y-4 text-[11px]">
          <div>
            <label className="text-[9px] uppercase font-bold text-sky-300 mb-1 block">{txt.weatherLabel}</label>
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600">
                {['OFF', 'NORMAL', 'EXTREME'].map((mode) => (
                <button key={mode} onClick={() => setWeatherMode(mode)} className={`flex-1 py-2 rounded text-[9px] font-bold transition ${weatherMode === mode ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>{txt.modes[mode]}</button>
                ))}
            </div>
          </div>
          
          <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3">
            <div><label className="flex justify-between mb-1 uppercase font-bold text-sky-400">{txt.waterLevel} <span className="font-mono">{waterLevelCm} cm</span></label>
            <input type="range" min="-300" max="300" value={waterLevelCm} onChange={(e) => setWaterLevelCm(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-sky-500" disabled={isSunkState || weatherMode !== 'OFF'} /></div>
            <div><label className="flex justify-between mb-1 uppercase font-bold text-emerald-400">{txt.depth} <span className="font-mono">{depthCm} cm</span></label>
            <input type="range" min="0" max="1200" value={depthCm} onChange={(e) => setDepthCm(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-emerald-500" disabled={isSunkState} /></div>
            
            <div>
              <div className="flex justify-between mb-1">
                <label className="uppercase font-bold text-amber-500">{txt.dockHeight} <span className="font-mono">{dockHeightCm} cm</span></label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="floatingDock" checked={isFloatingDock} onChange={(e) => setIsFloatingDock(e.target.checked)} className="w-3 h-3 accent-amber-500" disabled={isSunkState} />
                  <label htmlFor="floatingDock" className="text-[9px] text-amber-300 font-bold uppercase cursor-pointer">{txt.floatingDock}</label>
                </div>
              </div>
              <input type="range" min="100" max="500" value={dockHeightCm} onChange={(e) => setDockHeightCm(parseInt(e.target.value))} className={`w-full h-1 rounded-lg appearance-none ${isFloatingDock ? 'bg-slate-700 cursor-not-allowed' : 'bg-slate-700 accent-amber-500'}`} disabled={isSunkState || isFloatingDock} />
            </div>
            <div><label className="flex justify-between mb-1 uppercase font-bold text-slate-400">{txt.waveHeight} <span className="font-mono">{amplitude} cm</span></label>
            <input type="range" min="0" max="150" value={amplitude} onChange={(e) => setAmplitude(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-sky-500" disabled={isSunkState || weatherMode !== 'OFF'} /></div>
          </div>

          <div className="bg-white/5 p-3 rounded-lg border border-white/10">
            <label className="flex justify-between mb-2 uppercase font-bold text-sky-300">{txt.windSpeed} <span className="font-mono">{baseWind} m/s</span></label>
            <input type="range" min="0" max="40" value={baseWind} onChange={(e) => setBaseWind(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-sky-400" disabled={isSunkState || weatherMode !== 'OFF'} />
            <div className="flex gap-2 mt-3 text-[9px] font-bold uppercase text-center">
              <button onClick={() => setWindDirection(-1)} className={`flex-1 py-1 rounded border transition ${windDirection === -1 ? 'bg-sky-500 border-sky-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`} disabled={isSunkState || weatherMode !== 'OFF'}>{txt.fromDock}</button>
              <button onClick={() => setWindDirection(1)} className={`flex-1 py-1 rounded border transition ${windDirection === 1 ? 'bg-sky-500 border-sky-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`} disabled={isSunkState || weatherMode !== 'OFF'}>{txt.fromSea}</button>
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3 text-left">
            <div><label className="flex justify-between mb-1 uppercase font-bold text-blue-400">{txt.ropeLength} <span className="font-mono">{sternRopePart} cm</span></label>
            <input type="range" min="0" max="1500" value={sternRopePart} onChange={(e) => setSternRopePart(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-blue-600" disabled={isSunkState} /></div>
            <div><label className="flex justify-between mb-1 uppercase font-bold text-slate-100">{txt.chainLength} <span className="font-mono">{sternChainPart} cm</span></label>
            <input type="range" min="0" max="2000" value={sternChainPart} onChange={(e) => setSternChainPart(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-slate-400" disabled={isSunkState} /></div>
            <div className="pt-2 border-t border-white/5"><label className="flex justify-between mb-2 uppercase font-bold text-emerald-400">{txt.thickness} <span className="font-mono">{chainThickness} mm</span></label>
            <input type="range" min="6" max="16" step="1" value={chainThickness} onChange={(e) => setChainThickness(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-emerald-500" disabled={isSunkState} /></div>
            <div><label className="flex justify-between mb-1 uppercase font-bold text-emerald-400">{txt.anchorPos} <span className="font-mono">{anchorOffset} cm</span></label>
            <input type="range" min="0" max="2000" value={anchorOffset} onChange={(e) => setAnchorOffset(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-emerald-500" disabled={isSunkState} /></div>
          </div>

          <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-left">
            <label className="flex justify-between mb-1 uppercase font-bold text-amber-400">{txt.bowLine} <span className="font-mono">{frontRopeLength} cm</span></label>
            <input type="range" min="10" max="200" value={frontRopeLength} onChange={(e) => setFrontRopeLength(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-amber-400" disabled={isSunkState} />
          </div>

          {/* New Boat Length Slider */}
          <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-left">
            <label className="flex justify-between mb-1 uppercase font-bold text-purple-400">{txt.boatLength} <span className="font-mono">{boatLengthCm} cm</span></label>
            <input type="range" min="50" max="300" value={boatLengthCm} onChange={(e) => setBoatLengthCm(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-purple-400" disabled={isSunkState} />
          </div>
        </div>
      </div>

      <div className="absolute top-10 left-10 pointer-events-none text-left">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none border-l-4 border-sky-600 pl-4 text-sky-900">{txt.mainTitle}</h1>
        <p className="text-[9px] mt-2 pl-4 uppercase font-bold tracking-widest text-sky-700 italic opacity-80">Simulator v11.2 (Fix)</p>
      </div>

      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="block touch-none" />
    </div>
  );
};

export default App;