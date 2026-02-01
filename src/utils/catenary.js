/**
 * Solves the catenary equation for the given constraints.
 * 
 * A catenary is defined by y = a * cosh((x - offset) / a) + C
 * We need to find 'a' (the catenary parameter) such that the curve length between x1 and x2 matches 'length'.
 * 
 * Uses Newton-Raphson method to solve: sqrt(s^2 - v^2) = 2a * sinh(h / 2a)
 * where s = length, v = vertical distance (y2-y1), h = horizontal distance (x2-x1).
 */
/**
 * Solves the catenary equation for the given constraints.
 * 
 * A catenary is defined by y = a * cosh((x - offset) / a) + C
 * We need to find 'a' (the catenary parameter) such that the curve length between x1 and x2 matches 'length'.
 * 
 * Uses Newton-Raphson method to solve: sqrt(s^2 - v^2) = 2a * sinh(h / 2a)
 * where s = length, v = vertical distance (y2-y1), h = horizontal distance (x2-x1).
 */
export function solveCatenary(x1, y1, x2, y2, length) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If the chain is taut (or impossible), return a straight line approximation properties
    if (dist >= length - 0.01) {
        return { a: 0, isStraight: true, drawPoints: [{x: x1, y: y1}, {x: x2, y: y2}] };
    }

    const h = Math.max(0.001, Math.abs(dx));
    const v = dy; 

    // Standard Solver (Newton-Raphson)
    const rhs = Math.sqrt(length * length - v * v) / h;
    let z = 1.0; 
    if (rhs > 100) z = 6.0;

    for (let i = 0; i < 20; i++) {
        const sinhZ = Math.sinh(z);
        const coshZ = Math.cosh(z);
        const f = (sinhZ / z) - rhs;
        if (Math.abs(f) < 0.001) break;
        const df = (z * coshZ - sinhZ) / (z * z);
        if (Math.abs(df) < 1e-9) break; 
        let dz = f / df;
        if (Math.abs(dz) > 1.0) dz = Math.sign(dz) * 1.0;
        z = z - dz;
        if (z < 0.01) z = 0.01; 
    }
    
    // a = h / 2z
    // However, if the solved loop is extremely deep (huge length vs dist), 'a' becomes small.
    const a = h / (2 * z);

    // Calculate offsets
    const val = (length + v) / (length - v);
    const shiftX = (val <= 0) ? 0 : a * Math.log(val);
    const p = (x1 + x2 - shiftX) / 2;
    const q = y2 - a * Math.cosh((x2 - p) / a);
    
    // Generate drawing points
    const points = [];
    const segments = 50;
    
    // Order points from x1 to x2 (or match input direction)
    // We generated based on x1..x2 range.
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const cx = x1 + (x2 - x1) * t;
        const cy = a * Math.cosh((cx - p) / a) + q;
        points.push({x: cx, y: cy});
    }

    return { a: a, isStraight: false, drawPoints: points };
}

/**
 * Solves a catenary that is constrained by a seabed (y=0).
 * Assumes (x1,y1) is the Boat (Start, High) and (x2,y2) is the Anchor (End, y=0).
 * If the full catenary dips below y=0, this calculates a tangent "Touch Point".
 * The result is a hybrid path: Catenary (Boat -> Touch) + Line (Touch -> Anchor).
 */
export function solveSeabedCatenary(x1, y1, x2, y2, length) {
    // 1. Try standard solver first (for taut-ish chains that don't hit bottom)
    const std = solveCatenary(x1, y1, x2, y2, length);
    const vertexY = std.a * 1 + std.q; // cosh(0)=1
    
    // If purely suspended is valid (doesn't go underground), use it.
    if (std.isStraight || vertexY > -5) { 
        return std;
    }
    
    const H_height = y1; // Height of boat above seabed
    const Dist_Total = Math.abs(x2 - x1);
    const L_total = length;
    
    // 2. CHECK FOR EXCESS SLACK
    // Minimal geometric path is Vertical Drop (H_height) + Horizontal Run (Dist_Total).
    // If Length > (H_height + Dist_Total), we have slack piling up.
    // In this case, there is no tension (H=0).
    // Visual: Vertical drop to seabed, then run along seabed to anchor.
    // (Technically slightly curved drop due to self-weight, but vertical is fine for a=0).
    
    if (L_total > (H_height + Dist_Total)) {
        // Construct visual points: Boat -> Point Below Boat -> Anchor
        const points = [];
        points.push({x: x1, y: y1});
        points.push({x: x1, y: 0}); // Touching bottom directly below
        
        // Add resolution along the bottom
        const gSegs = 20;
        for(let i=1; i<=gSegs; i++) {
             const t = i/gSegs;
             points.push({x: x1 + (x2 - x1)*t, y: 0});
        }
        
        return {
            a: 1.0, // Minimal tension parameter (prevents div/0, but effectively 0)
            isStraight: false,
            drawPoints: points,
             // Explicitly signal physics engine that horizontal tension is zero
            tensionX: 0 
        };
    }
    
    // 3. SEABED LOGIC (Tangential Touch)
    // Used when chain is just tight enough to lift partially off ground but touches bottom vertically-ish?
    // Actually, tangential touch means slope matches?
    // The previous solver assumes catenary meets ground at 0 slope?
    // Yes, vertex of catenary is horizontal. If vertex is at y=0, it touches tangentially.
    // So we invoke "Vertex touches ground" mode.
    
    let sMin = H_height;
    let sMax = L_total;
    
    let bestS = L_total;
    let bestA = 100;
    let bestXLift = Dist_Total;

    // Binary Search
    for(let i=0; i<20; i++) {
        const s = (sMin + sMax) / 2;
        // Derived param a from s and height h
        // s = a * sinh(x/a) ... no.
        // y = a * cosh(x/a) - a.
        // at drop point x_lift: y = h.
        // s_lift = a * sinh(x_lift/a).
        // Identity: s^2 = y^2 + 2ay ? No. y = a(cosh-1).
        // (y+a)^2 = a^2 cosh^2 = a^2 (1 + sinh^2) = a^2 + s^2.
        // (h+a)^2 = a^2 + s^2
        // h^2 + 2ah + a^2 = a^2 + s^2
        // 2ah = s^2 - h^2
        // a = (s^2 - h^2) / 2h.  <-- CORRECT.
        
        const a = (s*s - H_height*H_height) / (2 * H_height);
        
        if (a <= 0.01) {
             sMin = s; continue; 
        }
        
        const term = (H_height + a) / a;
        const x_lift = a * Math.acosh(term);
        
        // Constraint: x_lift + (L_total - s) = Dist_Total
        const span = x_lift + (L_total - s);
        const error = span - Dist_Total;
        
        if (Math.abs(error) < 1) {
            bestS = s; bestA = a; bestXLift = x_lift;
            break;
        }
        
        // RE-VERIFIED LOGIC:
        // Increasing s (more suspended) -> Increases 'a' (flatter) -> INCREASES x_lift significantly.
        // Does it increase x_lift faster than it reduces ground chain (s)?
        // Yes, for reasonable catenaries, flattening gains horizontal reach.
        // So Span INCREASES with s.
        // If error > 0 (Span too wide), we need smaller s.
        
        if (error > 0) {
             sMax = s; // Reduce s
        } else {
             sMin = s; // Increase s
        }
        bestS = s; bestA = a; bestXLift = x_lift;
    }
    
    // Reconstruct Points
    const dir = x2 > x1 ? 1 : -1;
    const xTouch = x1 + (dir * bestXLift);
    
    const points = [];
    const segments = 30;
    for(let i=0; i<=segments; i++) {
        const t = i/segments;
        // From Boat to Touch
        const cx = x1 + (xTouch - x1) * t;
        const cy = bestA * Math.cosh((cx - xTouch)/bestA) - bestA;
        points.push({x: cx, y: cy});
    }
    
    const groundDist = Math.abs(x2 - xTouch);
    if (groundDist > 1) {
        const gSegs = 10;
        for(let i=1; i<=gSegs; i++) {
             const t = i/gSegs;
             points.push({x: xTouch + (x2 - xTouch)*t, y: 0});
        }
    }
    points.push({x: x2, y: 0});
    
    return {
        a: bestA,
        isStraight: false,
        drawPoints: points
    };
}

export function calculateWeight(widthMm) {
    // Approximate weight per meter for chain
    // Rule of thumb: Weight (kg/m) ~= 0.02 * diam(mm)^2
    return (widthMm * widthMm * 0.02);
}
